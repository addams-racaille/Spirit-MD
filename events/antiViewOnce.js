const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('../config');
const db = require('../db');

// Logger silencieux pour éviter le spam de Baileys lors du download
const silentLogger = pino({ level: 'silent' });

module.exports = async (sock, msg) => {
    try {
        const sessionId = sock.customSessionId || 'master';
        if (!msg.message) return;

        const isViewOnce =
            msg.message.viewOnceMessage ||
            msg.message.viewOnceMessageV2 ||
            msg.message.viewOnceMessageV2Extension;

        if (!isViewOnce) return;

        // Ignorer les messages envoyés par le bot lui-même
        if (msg.key.fromMe) return;

        const antiVvStatus = await db.getSessionVar(sessionId, 'ANTI_VV', 'off');
        if (antiVvStatus === 'off') return;

        let targetJid = msg.key.remoteJid;
        if (antiVvStatus === 'sudo') {
            const ownerNum = sock.customOwner || config.OWNER_NUMBER;
            if (ownerNum) targetJid = `${ownerNum}@s.whatsapp.net`;
        } else if (antiVvStatus === 'custom') {
            const customJid = await db.getSessionVar(sessionId, 'ANTI_VV_JID', '');
            if (customJid) targetJid = customJid;
        }

        const viewOnceContent = isViewOnce.message;
        if (!viewOnceContent) return;

        const mediaType = Object.keys(viewOnceContent)[0]; // imageMessage | videoMessage | audioMessage
        if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(mediaType)) return;

        // Faux message pointant directement sur le média
        const fakeMsg = { key: msg.key, message: viewOnceContent };

        const buffer = await downloadMediaMessage(
            fakeMsg,
            'buffer',
            {},
            { logger: silentLogger, reuploadRequest: sock.updateMediaMessage }
        );

        if (!buffer || buffer.length === 0) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const isGroup = msg.key.remoteJid.endsWith('@g.us');

        let caption = `👁️ *ANTI VUE-UNIQUE*\n\n`;
        caption += `👤 *Par:* @${sender.split('@')[0]}\n`;
        if (isGroup) caption += `🌐 *Groupe:* ${msg.key.remoteJid}\n`;

        const originalCaption = viewOnceContent[mediaType]?.caption;
        if (originalCaption) caption += `📝 *Légende:* ${originalCaption}\n`;

        if (mediaType === 'imageMessage') {
            await sock.sendMessage(targetJid, { image: buffer, caption, mentions: [sender] });
        } else if (mediaType === 'videoMessage') {
            await sock.sendMessage(targetJid, { video: buffer, caption, mentions: [sender] });
        } else if (mediaType === 'audioMessage') {
            await sock.sendMessage(targetJid, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
        }

    } catch (e) {
        // Silencieux — les VV expirés lancent une erreur non critique
        if (!e.message?.includes('404') && !e.message?.includes('not found')) {
            console.error('Anti-VV Error:', e.message);
        }
    }
};
