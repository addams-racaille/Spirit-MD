const chalk = require('chalk');
const db = require('../db');
const { OWNER_NUMBER } = require('../config');

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
    const sessionId = sock.customSessionId || 'master';
    const proto = msg.message?.protocolMessage;
    // type 14 = MESSAGE_EDIT
    if (!proto || (proto.type !== 14 && proto.type !== 'MESSAGE_EDIT')) return;

    const editedId = proto.key?.id;
    const cached = editedId ? messageCache.get(editedId) : null;
    if (!cached) return;

    const antiEditMode = await db.getSessionVar(sessionId, 'ANTI_EDIT', 'chat');
    if (antiEditMode === 'off') return;

    const originalChat = cached.key.remoteJid;
    const originalSender = cached.key.participant || originalChat;
    const contactId = originalSender.split('@')[0];

    // Ignorer l'owner natif et l'owner de la session
    if (OWNER_NUMBER && contactId === OWNER_NUMBER) return;
    if (sock.customOwner && contactId === sock.customOwner) return;

    // Ignorer les exceptions
    const exceptions = await db.getExceptions(sessionId);
    if (exceptions.includes(originalChat) || exceptions.includes(originalSender)) return;

    const oldBody = getBody(cached) || '[Message non textuel]';
    const newBody =
        proto.editedMessage?.conversation ||
        proto.editedMessage?.extendedTextMessage?.text ||
        '[inconnu]';

    // On ne notifie que si le contenu a vraiment changé
    if (oldBody === newBody) return;

    console.log(chalk.yellow(`✏️ Modification détectée de ${contactId} (${editedId})`));

    // Destination
    let targetJid = originalChat;
    if (antiEditMode === 'sudo') {
        const ownerNum = sock.customOwner || OWNER_NUMBER;
        targetJid = ownerNum ? `${ownerNum}@s.whatsapp.net` : (sock.user?.id?.split(':')[0] + '@s.whatsapp.net');
    } else if (antiEditMode === 'custom') {
        const customJid = await db.getSessionVar(sessionId, 'ANTI_EDIT_JID', '');
        if (customJid) targetJid = customJid;
    }

    try {
        await sock.sendMessage(targetJid, {
            text: `✏️ Modifié par @${contactId}\n\n*Avant :* ${oldBody}\n*Après :* ${newBody}`,
            mentions: [originalSender]
        }, { quoted: cached });

        // MAJ du cache avec le nouveau contenu
        const updated = { ...cached, message: proto.editedMessage };
        messageCache.set(editedId, updated);
    } catch (e) {
        console.log(chalk.red('Err anti-edit:'), e.message);
    }
};
