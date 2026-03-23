const chalk = require('chalk');
const db = require('../db');
const { OWNER_NUMBER } = require('../config');

module.exports = async function handleAntiDelete(sock, msg, messageCache) {
    const sessionId = sock.customSessionId || 'master';
    const proto = msg.message?.protocolMessage;
    // type 0 = REVOKE
    if (!proto || (proto.type !== 0 && proto.type !== 'REVOKE')) return;

    const deletedId = proto.key?.id;
    const cached = deletedId ? messageCache.get(deletedId) : null;
    if (!cached) return;

    const antiDeleteMode = await db.getSessionVar(sessionId, 'ANTI_DELETE', 'chat');
    if (antiDeleteMode === 'off') return;

    const originalChat = cached.key.remoteJid;
    const originalSender = cached.key.participant || originalChat;
    const contactId = originalSender.split('@')[0];

    // Ignorer l'owner
    if (OWNER_NUMBER && contactId === OWNER_NUMBER) return;
    // Ignorer l'owner de la session (sous-bots)
    if (sock.customOwner && contactId === sock.customOwner) return;

    // Ignorer les exceptions
    const exceptions = await db.getExceptions(sessionId);
    if (exceptions.includes(originalChat) || exceptions.includes(originalSender)) return;

    console.log(chalk.red(`🗑️ Suppression détectée de ${contactId} (${deletedId})`));

    // Destination
    let targetJid = originalChat;
    if (antiDeleteMode === 'sudo') {
        const ownerNum = sock.customOwner || OWNER_NUMBER;
        targetJid = ownerNum ? `${ownerNum}@s.whatsapp.net` : (sock.user?.id?.split(':')[0] + '@s.whatsapp.net');
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
};
