const chalk = require('chalk');
const db = require('../db');

// Helper : recupère le texte complet d'un objet message
function getBody(msg) {
    const m = msg.message;
    if (!m) return '';
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.buttonsResponseMessage?.selectedButtonId ||
        m.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ''
    );
}

module.exports = async function handleAntiEdit(sock, msg, messageCache) {
    const proto = msg.message?.protocolMessage;
    // type 14 = MESSAGE_EDIT
    if (!proto || (proto.type !== 14 && proto.type !== 'MESSAGE_EDIT')) return;

    const editedId = proto.key?.id;
    const cached = editedId ? messageCache.get(editedId) : null;
    
    if (cached) {
        // Vérifier les paramètres utilisateur (off, chat, sudo, custom JID)
        const antiEditMode = await db.getVar('ANTI_EDIT', 'chat');
        if (antiEditMode === 'off') return;

        const originalChat = cached.key.remoteJid;
        const originalSender = cached.key.participant || originalChat;
        const contactId = originalSender.split('@')[0];

        // 1. Ignorer l'Owner natif
        const { OWNER_NUMBER } = require('../config');
        if (OWNER_NUMBER && contactId === OWNER_NUMBER) return;

        // 2. Ignorer les exceptions (numéro ou groupe entier)
        const exceptions = await db.getExceptions();
        if (exceptions.includes(originalChat) || exceptions.includes(originalSender)) return;
        
        const oldBody = getBody(cached) || '[Message non textuel]';
        const newBody = proto.editedMessage?.conversation || 
                        proto.editedMessage?.extendedTextMessage?.text || 
                        '[inconnu]';

        console.log(chalk.yellow(`✏️ Modification détectée de ${contactId} (${editedId})`));
        
        // Déterminer où envoyer la notification
        let targetJid = originalChat; // par défaut: 'chat'
        
        if (antiEditMode === 'sudo') {
            if (OWNER_NUMBER && OWNER_NUMBER.match(/^\d+$/)) {
                targetJid = `${OWNER_NUMBER}@s.whatsapp.net`;
            } else {
                targetJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            }
        } else if (antiEditMode === 'custom') {
            const customJid = await db.getVar('ANTI_EDIT_JID', '');
            if (customJid) targetJid = customJid;
        }
        
        try {
            await sock.sendMessage(targetJid, {
                text: `👀 Modifié par @${contactId}\n\n*Avant :* ${oldBody}\n*Après :* ${newBody}`,
                mentions: [originalSender]
            }, { quoted: cached });
            
            // Mettre à jour le cache local pour de futures opérations
            const newMsgContext = JSON.parse(JSON.stringify(cached));
            newMsgContext.message = proto.editedMessage;
            messageCache.set(editedId, newMsgContext);
        } catch (e) {
            console.log(chalk.red('Err anti-edit:'), e.message);
        }
    }
};
