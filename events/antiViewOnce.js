const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const config = require('../config');
const db = require('../db');

module.exports = async (sock, msg) => {
    try {
        if (!msg.message) return;

        const isViewOnce = msg.message.viewOnceMessage || 
                           msg.message.viewOnceMessageV2 || 
                           msg.message.viewOnceMessageV2Extension;

        if (!isViewOnce) return;

        const antiVvStatus = await db.getVar('ANTI_VV', 'off');
        if (antiVvStatus === 'off') return;

        let targetJid = msg.key.remoteJid;
        if (antiVvStatus === 'sudo') {
            targetJid = sock.customOwner ? `${sock.customOwner}@s.whatsapp.net` : `${config.OWNER_NUMBER}@s.whatsapp.net`;
        } else if (antiVvStatus === 'custom') {
            const customJid = await db.getVar('ANTI_VV_JID', '');
            if (customJid) targetJid = customJid;
        }

        const viewOnceContent = isViewOnce.message;
        const mediaType = Object.keys(viewOnceContent)[0];

        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { 
                logger: console,
                reuploadRequest: sock.updateMediaMessage 
            }
        );

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
            await sock.sendMessage(targetJid, { text: caption, mentions: [sender] });
            await sock.sendMessage(targetJid, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
        }

    } catch (e) {
        console.error('Anti-VV Error:', e.message);
    }
};
