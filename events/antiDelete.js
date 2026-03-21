const chalk = require('chalk');
const db = require('../db');

module.exports = async function handleAntiDelete(sock, msg, messageCache) {
    const sessionId = sock.customSessionId || 'master';
    const proto = msg.message?.protocolMessage;
    // Vérifier s'il s'agit d'un message effacé (REVOKE)
    if (!proto || (proto.type !== 0 && proto.type !== 'REVOKE')) return;

    const deletedId = proto.key?.id;
    const cached = deletedId ? messageCache.get(deletedId) : null;
    
    if (cached) {
        // Vérifier les paramètres utilisateur (off, chat, sudo, custom JID) (isolé par session)
        const antiDeleteMode = await db.getSessionVar(sessionId, 'ANTI_DELETE', 'chat');
        if (antiDeleteMode === 'off') return;

        // On utilise l'ID du chat d'origine depuis le cache car msg.key.remoteJid 
        // peut parfois être une adresse d'appareil lié silencieuse (@lid)
        const originalChat = cached.key.remoteJid;
        // Et l'expéditeur original :
        const originalSender = cached.key.participant || originalChat;
        const contactId = originalSender.split('@')[0];

        // 1. Ignorer l'Owner natif
        const { OWNER_NUMBER } = require('../config');
        if (OWNER_NUMBER && contactId === OWNER_NUMBER) return;

        // 2. Ignorer les exceptions (numéro ou groupe entier, par session)
        const exceptions = await db.getExceptions(sessionId);
        if (exceptions.includes(originalChat) || exceptions.includes(originalSender)) return;
        
        console.log(chalk.red(`🗑️ Suppression détectée de ${contactId} (${deletedId})`));
        
        // Déterminer où envoyer la notification
        let targetJid = originalChat; // par défaut: 'chat'
        
        if (antiDeleteMode === 'sudo') {
            if (OWNER_NUMBER && OWNER_NUMBER.match(/^\d+$/)) {
                targetJid = `${OWNER_NUMBER}@s.whatsapp.net`;
            } else {
                targetJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'; // S'envoie à lui-même
            }
        } else if (antiDeleteMode === 'custom') {
            const customJid = await db.getSessionVar(sessionId, 'ANTI_DELETE_JID', '');
            if (customJid) targetJid = customJid;
        }

        try {
            await sock.sendMessage(targetJid, {
                text: `👀 Un message a été supprimé par @${contactId}`,
                mentions: [originalSender]
            });
            await sock.sendMessage(targetJid, { forward: cached });
            messageCache.del(deletedId);
        } catch (e) {
            console.log(chalk.red('Err anti-delete:'), e.message);
        }
    }
};
