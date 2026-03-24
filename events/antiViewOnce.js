const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('../config');
const db = require('../db');

const silentLogger = pino({ level: 'silent' });

module.exports = async (sock, msg) => {
    try {
        const sessionId = sock.customSessionId || 'master';

        // ✅ Checks rapides en premier
        if (!msg.message) return;
        if (msg.key.fromMe) return;  // ← remonté ici

        const viewOnceContent =
            msg.message.viewOnceMessage?.message ||
            msg.message.viewOnceMessageV2?.message ||
            msg.message.viewOnceMessageV2Extension?.message;

        if (!viewOnceContent) return;

        const antiVvStatus = await db.getSessionVar(sessionId, 'ANTI_VV', 'off');
        if (antiVvStatus === 'off') return;

        let targetJid = msg.key.remoteJid;
        if (antiVvStatus === 'sudo') {
            let ownerNum = sock.customOwner || config.OWNER_NUMBER;
            if (ownerNum) {
                // S'assurer que le numéro ne contient que des chiffres purs (retirer les + ou espaces)
                ownerNum = ownerNum.toString().replace(/[^\d]/g, '');
                targetJid = `${ownerNum}@s.whatsapp.net`;
            } else if (sock.user && sock.user.id) {
                targetJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            }
        } else if (antiVvStatus === 'custom') {
            const customJid = await db.getSessionVar(sessionId, 'ANTI_VV_JID', '');
            if (customJid) targetJid = customJid;
        }

        const mediaType = Object.keys(viewOnceContent)[0];
        if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(mediaType)) return;

        // ✅ fakeMsg avec viewOnceContent direct (pas wrappé)
        const fakeMsg = {
            key: msg.key,
            message: viewOnceContent
        };

        const buffer = await downloadMediaMessage(
            fakeMsg,
            'buffer',
            {},
            {
                logger: silentLogger,
                reuploadRequest: sock.updateMediaMessage.bind(sock)
            }
        );

        if (!buffer || buffer.length === 0) return;

        // ✅ sender robuste
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
            await sock.sendMessage(targetJid, {
                audio: buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            });
        }

    } catch (e) {
        if (!e.message?.includes('404') && !e.message?.includes('not found')) {
            console.error('Anti-VV Error:', e.message);
        }
    }
};