const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const playdl = require('play-dl');
const ytdlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const crypto = require('crypto');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const config = require('../config');

// Helper sécurisé pour les téléchargements de tout type (Youtube, Tiktok, IG, FB)
async function downloadMedia(ctx, type) {
    const { q, from, sock, msg, editMsg, reply } = ctx;
    if (!q) {
        return await reply(`_Veuillez fournir un titre ou un lien !_`);
    }

    const statusMsg = await reply('_🔍 Recherche en cours..._');

    try {
        let videoUrl = q;
        let videoTitle = 'Media';
        let isYt = q.includes('youtube.com') || q.includes('youtu.be');
        
        // Si c'est juste un texte libre, on recherche sur youtube
        if (!q.startsWith('http')) {
            const searched = await playdl.search(q, { source: { youtube: 'video' }, limit: 1 });
            if (!searched || searched.length === 0) {
                return await editMsg(statusMsg, '_❌ Aucun résultat trouvé._');
            }
            videoUrl = `https://www.youtube.com/watch?v=${searched[0].id}`;
            videoTitle = searched[0].title;
        } else {
            // C'est un lien, on laisse yt-dlp gérer (yt-dlp supporte youtube, tiktok, facebook, twitter, instagram, etc.)
            videoTitle = "Téléchargement en cours";
        }

        await editMsg(statusMsg, `_⬇️ Téléchargement... Veuillez patienter._`);

        const tmpDir = path.join(__dirname, '../tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
        
        const isAudio = type === 'audio';
        const ext = isAudio ? 'mp3' : 'mp4';
        const mediaPath = path.join(tmpDir, `${Date.now()}.${ext}`);

        // Paramètres YT-DLP flexibles pour tous réseaux
        let dlOptions = {
            output: mediaPath,
            noPlaylist: true,
            quiet: true,
        };

        if (isAudio) {
            dlOptions.extractAudio = true;
            dlOptions.audioFormat = 'mp3';
            dlOptions.audioQuality = 0;
        } else {
            // Meilleure vidéo avec fallback mp4
            dlOptions.format = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
        }

        // Exécution via yt-dlp
        await ytdlp(videoUrl, dlOptions);

        if (!fs.existsSync(mediaPath)) {
            throw new Error('Le fichier est introuvable après le téléchargement.');
        }

        await editMsg(statusMsg, `_📤 Envoi au serveur WhatsApp..._`);

        let sendPayload = {};
        if (isAudio) {
            sendPayload = {
                audio: fs.readFileSync(mediaPath),
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `${videoTitle}.mp3`
            };
        } else {
            sendPayload = {
                video: fs.readFileSync(mediaPath),
                mimetype: 'video/mp4',
                caption: `_🎬 ${videoTitle}_`
            };
        }

        await sock.sendMessage(from, sendPayload, { quoted: msg });
        await editMsg(statusMsg, `_✅ Terminé !_`);

        // Nettoyage
        fs.unlinkSync(mediaPath);

    } catch (error) {
        console.log(chalk.red('[MEDIA ERREUR]'), error.message);
        let errMsg = error.message;
        if (errMsg.includes('Unsupported URL')) errMsg = "Ce site n'est pas (encore) pris en charge.";
        if (errMsg.includes('Sign in to confirm')) errMsg = "Ce média demande une vérification d'âge (18+).";
        await editMsg(statusMsg, `_❌ Erreur de téléchargement :_ ${errMsg}`);
    }
}

module.exports = [
    {
        name: 'play',
        aliases: ['song', 'yta', 'mp3', 'music', 'audio'],
        desc: 'Télécharge une musique au format MP3 Haute Qualité via un lien direct ou une simple recherche textuelle.',
        usage: '.play <lien ou titre>',
        execute: async (ctx) => {
            await downloadMedia(ctx, 'audio');
        }
    },
    {
        name: 'video',
        aliases: ['mp4', 'ytv', 'tiktok', 'ig', 'fb', 'reel'],
        desc: 'Télécharge n\'importe quelle vidéo depuis YouTube, TikTok, Instagram (Reels), Facebook sans filigrane.',
        usage: '.video <lien ou titre>',
        execute: async (ctx) => {
            await downloadMedia(ctx, 'video');
        }
    },
    {
        name: 'sticker',
        aliases: ['s', 'crop'],
        desc: 'Transforme instantanément n\'importe quelle image, photo ou courte vidéo (<10s) en un sticker WhatsApp.',
        usage: 'A répondre à un media avec: .sticker',
        execute: async (ctx) => {
            const { sock, msg, commandName, from, reply } = ctx;
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const quotedMsg = context?.quotedMessage;

            let mediaMessage = quotedMsg?.imageMessage || quotedMsg?.videoMessage || msg.message?.imageMessage || msg.message?.videoMessage;
            let type = '';

            if (quotedMsg?.imageMessage || msg.message?.imageMessage) type = 'image';
            else if (quotedMsg?.videoMessage || msg.message?.videoMessage) type = 'video';

            if (!mediaMessage) {
                return await reply(`_Veuillez répondre à une image ou une vidéo avec \`.${commandName}\`_`);
            }

            if (type === 'video' && mediaMessage.seconds > 10) {
                return await reply(`_⚠️ La vidéo est trop longue (max 10s pour un sticker)_`);
            }

            await reply(`_🐬 Création du sticker en cours..._`);

            try {
                const stream = await downloadContentFromMessage(mediaMessage, type);
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                const tempDir = path.join(__dirname, '../temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

                const rnd = crypto.randomBytes(4).toString('hex');
                const inPath = path.join(tempDir, `in_${rnd}.${type === 'image' ? 'jpg' : 'mp4'}`);
                const outPath = path.join(tempDir, `out_${rnd}.webp`);

                fs.writeFileSync(inPath, buffer);

                let vfOutput = '';
                if (commandName === 'crop') {
                    vfOutput = "crop=w='min(iw,ih)':h='min(iw,ih)',scale=512:512";
                } else {
                    vfOutput = "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0";
                }

                await new Promise((resolve, reject) => {
                    ffmpeg(inPath)
                        .outputOptions([
                            '-vcodec libwebp',
                            `-vf ${vfOutput}`,
                            '-lossless 0',
                            '-qscale 50',
                            '-preset default',
                            '-loop 0',
                            '-an',
                            '-vsync 0',
                            '-s 512:512'
                        ])
                        .toFormat('webp')
                        .on('end', () => resolve())
                        .on('error', (err) => reject(err))
                        .save(outPath);
                });

                const stickerBuffer = fs.readFileSync(outPath);
                await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });

                fs.unlinkSync(inPath);
                fs.unlinkSync(outPath);

            } catch (err) {
                console.log(err);
                await reply(`_❌ Erreur lors de la création du sticker._`);
            }
        }
    },
    {
        name: 'vv',
        aliases: ['viewonce'],
        desc: 'Contrecarre la "Vue Unique" en téléchargeant l\'image/vidéo éphémère directement dans le chat (Mode public).',
        usage: 'A répondre au message éphémère: .vv',
        execute: async (ctx) => {
            const { sock, msg, from, reply } = ctx;
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const quotedMsg = context?.quotedMessage;

            if (!quotedMsg) {
                return await reply(`_Réponds à un message en vue unique avec \`.vv\`_`);
            }

            const voWrappers = [
                quotedMsg.viewOnceMessage?.message,
                quotedMsg.viewOnceMessageV2?.message,
                quotedMsg.viewOnceMessageV2Extension?.message,
                quotedMsg,
            ];

            let mediaMessage = null;
            let type = null;

            for (const wrapper of voWrappers) {
                if (!wrapper) continue;
                if (wrapper.imageMessage) {
                    mediaMessage = wrapper.imageMessage;
                    type = 'image';
                    break;
                }
                if (wrapper.videoMessage) {
                    mediaMessage = wrapper.videoMessage;
                    type = 'video';
                    break;
                }
            }

            if (!mediaMessage || !type) {
                return await reply(`_Ce message n'est pas une vue unique ou a déjà expiré._`);
            }

            try {
                const stream = await downloadContentFromMessage(mediaMessage, type);
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                const mimetype = mediaMessage.mimetype || (type === 'image' ? 'image/jpeg' : 'video/mp4');

                if (type === 'image') {
                    await sock.sendMessage(from, { image: buffer, mimetype }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { video: buffer, mimetype }, { quoted: msg });
                }
            } catch (e) {
                console.log(chalk.red('Err viewonce:'), e.message);
                await reply(`_❌ Impossible de récupérer ce message._`);
            }
        }
    }
];
