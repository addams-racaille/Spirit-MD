const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const playdl = require('play-dl');
const ytdlp = require('yt-dlp-exec');
const config = require('./config');
const db = require('./db');
const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');

const crypto = require('crypto');

// --- Helper Functions ---
function timeSince(date) {
    if (!date) return "Jamais";
    var seconds = Math.floor((new Date() - new Date(date)) / 1000);
    var interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " ans";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " mois";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " jours";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " heures";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes";
    return Math.floor(seconds) + " secondes";
}

function parseDuration(duration) {
    const regex = /^(\d+)([dwmy])$/i;
    const match = duration.match(regex);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const now = new Date();
    switch (unit) {
        case "d": return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
        case "w": return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
        case "m": return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
        case "y": return new Date(now.getTime() - value * 365 * 24 * 60 * 60 * 1000);
        default: return null;
    }
}


module.exports = async (sock, msg, commandName, q, from, messageCache) => {
    try {
        const isFromMe = msg.key.fromMe;
        const currentMode = await db.getVar('MODE', 'public');
        
        // Détection du propriétaire dynamique (SaaS)
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const ownerNumberStr = sock.customOwner || config.OWNER_NUMBER || '';
        const isOwner = isFromMe || senderJid === `${ownerNumberStr}@s.whatsapp.net`;
        const isMasterAdmin = isOwner && sock.isMaster;
        
        // Si privé, seules les commandes venant du proprio (isOwner) sont acceptées
        if (currentMode === 'private' && !isOwner) {
            return;
        }

        const reply = async (text) => {
            return await sock.sendMessage(from, { text }, { quoted: msg });
        };

        // Édite un message déjà envoyé
        const editMsg = async (sentMsg, newText) => {
            try {
                await sock.sendMessage(from, { text: newText, edit: sentMsg.key });
            } catch(e) {
                // Fallback : envoyer un nouveau message si l'édition échoue
                await sock.sendMessage(from, { text: newText });
            }
        };

        // ─── PING ───────────────────────────────────────────────────────────
        if (commandName === 'ping') {
            await reply('Pong ! 🏓 Le bot est bien en ligne.');
        }

        // ─── MUSIQUE (play / song / yta / mp3 / music = même commande) ──────
        const MUSIC_CMDS = ['play', 'song', 'yta', 'mp3', 'music'];
        if (MUSIC_CMDS.includes(commandName)) {
            if (!q) {
                return await reply(`_Veuillez fournir un titre ou un lien YouTube !_\n_Exemple : ${config.PREFIX}play faded alan walker_`);
            }

            // Envoyer le message "recherche" et le garder en référence pour l'éditer
            const statusMsg = await reply('_🔍 Recherche en cours..._');

            try {
                let videoUrl = q;
                let videoTitle = 'Audio';
                let videoDuration = null; // en secondes

                if (!q.includes('youtube.com') && !q.includes('youtu.be')) {
                    // Recherche par titre
                    const searched = await playdl.search(q, { source: { youtube: 'video' }, limit: 1 });
                    if (!searched || searched.length === 0) {
                        return await editMsg(statusMsg, '_❌ Aucun résultat trouvé sur YouTube._');
                    }
                    videoUrl = `https://www.youtube.com/watch?v=${searched[0].id}`;
                    videoTitle = searched[0].title;
                    videoDuration = searched[0].durationInSec || null;
                } else {
                    // Lien direct
                    const ytMatch = q.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
                    if (ytMatch) videoUrl = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
                    try {
                        const info = await playdl.video_info(videoUrl);
                        videoTitle = info.video_details.title;
                        videoDuration = info.video_details.durationInSec || null;
                    } catch(e) {}
                }

                // Estimation du temps de téléchargement basée sur la durée de la vidéo
                let estimate = '~15s';
                if (videoDuration) {
                    const secs = Math.max(5, Math.ceil(videoDuration / 20));
                    estimate = secs < 60 ? `~${secs}s` : `~${Math.ceil(secs / 60)}min`;
                }

                // Éditer le message "recherche" → "téléchargement"
                await editMsg(statusMsg, `_⬇️ Téléchargement de_ *${videoTitle}* _(${estimate})..._`);

                console.log(chalk.blue(`[MUSIQUE] ${videoTitle} | ${videoUrl}`));

                // Dossier tmp
                const tmpDir = path.join(__dirname, 'tmp');
                if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
                const audioPath = path.join(tmpDir, `${Date.now()}.mp3`);

                // Téléchargement via yt-dlp
                await ytdlp(videoUrl, {
                    output: audioPath,
                    extractAudio: true,
                    audioFormat: 'mp3',
                    audioQuality: 0,
                    noPlaylist: true,
                    quiet: true,
                });

                if (!fs.existsSync(audioPath)) {
                    throw new Error('Fichier audio introuvable après téléchargement');
                }

                // Éditer encore une fois → "envoi en cours"
                await editMsg(statusMsg, `_📤 Envoi de_ *${videoTitle}* _sur WhatsApp..._`);

                await sock.sendMessage(from, {
                    audio: fs.readFileSync(audioPath),
                    mimetype: 'audio/mpeg',
                    ptt: false,
                    fileName: `${videoTitle}.mp3`
                }, { quoted: msg });

                // Message final dans la bulle du statut
                await editMsg(statusMsg, `_✅ *${videoTitle}* envoyé !_`);

                fs.unlinkSync(audioPath);
                console.log(chalk.green(`[MUSIQUE] ✅ Envoyé : ${videoTitle}`));

            } catch (error) {
                console.log(chalk.red('[MUSIQUE ERREUR]'), error.message);
                await editMsg(statusMsg, `_❌ Erreur :_ ${error.message}`);
            }
        }

        // ─── STATISTIQUES (msgs, users) ──────────────────────────────────────
        if (commandName === 'msgs') {
            const isGroup = from.endsWith('@g.us');
            if (!isGroup) return await reply("_❌ Cette commande ne fonctionne que dans les groupes._");
            
            const stats = await db.fetchFromStore(from);
            if (stats.length === 0) return await reply("_Aucun message enregistré dans ce groupe._");
            
            // Tri par nombre de messages
            stats.sort((a, b) => b.totalMessages - a.totalMessages);
            
            let final_msg = `📊 *MESSAGES DU GROUPE*\n_(${stats.length} membres actifs)_\n\n`;
            for (let stat of stats.slice(0, 50)) { // Limiter à 50 pour pas spammer
                let userJid = stat.jid;
                let count = stat.totalMessages;
                let name = stat.name || "Inconnu";
                let lastMsg = timeSince(stat.lastMessageAt);
                
                final_msg += `👤 *${name}* (@${userJid.split('@')[0]})\n`;
                final_msg += `💬 Total : ${count} | 🕒 Vu: ${lastMsg}\n\n`;
            }
            
            await sock.sendMessage(from, { text: final_msg, mentions: stats.map(s => s.jid) }, { quoted: msg });
        }

        if (commandName === 'users') {
            const isGlobal = q.includes('global') || !from.endsWith('@g.us');
            const limitMatch = q.match(/\d+/);
            const limit = Math.min(limitMatch ? parseInt(limitMatch[0]) : 10, 50);
            
            let topUsers;
            let scopeText;

            if (isGlobal) {
                topUsers = await db.getGlobalTopUsers(limit);
                scopeText = "Global";
            } else {
                topUsers = await db.getTopUsers(from, limit);
                scopeText = "Groupe";
            }

            if (topUsers.length === 0) {
                return await reply(`_Aucune donnée trouvée pour le classement ${scopeText}._`);
            }

            let responseMsg = `🏆 *TOP ${topUsers.length} UTILISATEURS (${scopeText})*\n\n`;
            for (let i = 0; i < topUsers.length; i++) {
                const user = topUsers[i];
                const rank = i + 1;
                const name = user.name || "Inconnu";
                const lastMessage = timeSince(user.lastMessageAt);

                responseMsg += `*#${rank}* @${user.jid.split("@")[0]}\n`;
                responseMsg += `   _Nom :_ ${name}\n`;
                responseMsg += `   _Messages :_ ${user.totalMessages}\n`;
                responseMsg += `   _Dernier msg :_ ${lastMessage}\n\n`;
            }

            await sock.sendMessage(from, { text: responseMsg, mentions: topUsers.map(u => u.jid) }, { quoted: msg });
        }

        // ─── MODÉRATION (inactive) ──────────────────────────────────────────
        if (commandName === 'inactive') {
            const isGroup = from.endsWith('@g.us');
            if (!isGroup) return await reply("_❌ Cette commande ne fonctionne que dans les groupes._");

            const args = q.trim().split(" ");
            const durationStr = args[0];
            const shouldKick = args[1]?.toLowerCase() === "kick";

            if (!durationStr) {
                return await reply(
                    "_Utilisation (Admin/Bot) :_\n" +
                    "• `.inactive 30d` - Voir membres inactifs (>30j)\n" +
                    "• `.inactive 10d kick` - Expulser inactifs (>10j)\n" +
                    "_Unités :_ d (jour), w (semaine), m (mois), y (année)"
                );
            }

            const cutoffDate = parseDuration(durationStr);
            if (!cutoffDate) return await reply("_Format invalide. Ex: 30d, 2w, 3m_");

            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants;
            const userStats = await db.fetchFromStore(from);

            let inactiveMembers = [];
            for (let p of participants) {
                let jid = p.id;
                let stat = userStats.find(s => s.jid === jid);
                
                if (!stat || !stat.lastMessageAt) {
                    inactiveMembers.push({ jid, name: stat?.name || "Inconnu", lastMessage: "Jamais", totalMessages: stat?.totalMessages || 0 });
                } else {
                    const lastMsgDate = new Date(stat.lastMessageAt);
                    if (lastMsgDate < cutoffDate) {
                        inactiveMembers.push({ jid, name: stat.name, lastMessage: timeSince(stat.lastMessageAt), totalMessages: stat.totalMessages });
                    }
                }
            }

            if (shouldKick) {
                // Filtrer pour ne pas kick les admins ni le bot lui-même
                const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                inactiveMembers = inactiveMembers.filter(m => {
                    const p = participants.find(part => part.id === m.jid);
                    return !p?.admin && m.jid !== botId;
                });
            }

            if (inactiveMembers.length === 0) return await reply(`_Aucun inactif trouvé pour la durée : ${durationStr}_`);

            let responseMsg = `💤 *MEMBRES INACTIFS (${durationStr}+) : ${inactiveMembers.length}*\n\n`;

            if (shouldKick) {
                responseMsg += `_❗️ Expulsion de ${inactiveMembers.length} membre(s) dans 5s..._\n`;
                for (let i = 0; i < Math.min(inactiveMembers.length, 10); i++) {
                    responseMsg += `${i+1}. @${inactiveMembers[i].jid.split('@')[0]}\n`;
                }
                if (inactiveMembers.length > 10) responseMsg += `...${inactiveMembers.length - 10} autres\n`;
                
                await sock.sendMessage(from, { text: responseMsg, mentions: inactiveMembers.map(m => m.jid) });
                await new Promise(r => setTimeout(r, 5000));
                
                let kickCount = 0;
                for (let member of inactiveMembers) {
                    try {
                        await sock.groupParticipantsUpdate(from, [member.jid], "remove");
                        kickCount++;
                        await new Promise(r => setTimeout(r, 1000)); // Pause pour anti-spam
                    } catch(e) {}
                }
                return await reply(`_✅ ${kickCount} inactif(s) expulsé(s)._`);
            } else {
                for (let i = 0; i < inactiveMembers.length; i++) {
                    const m = inactiveMembers[i];
                    responseMsg += `${i+1}. @${m.jid.split('@')[0]} (${m.name})\n`;
                    responseMsg += `   _Vu : ${m.lastMessage} | Kicks : ${m.totalMessages}_\n\n`;
                }
                responseMsg += `\n_Pour expulser: .inactive ${durationStr} kick_`;
                await sock.sendMessage(from, { text: responseMsg, mentions: inactiveMembers.map(m => m.jid) }, { quoted: msg });
            }
        }

        // ─── SÉCURITÉ OWNER ─────────────────────────────────────────────────
        // Les paramètres suivants ne peuvent être modifiés que par l'Owner
        const adminCommands = ['mode', 'antidelete', 'antiedit', 'autostatus', 'except', 'config'];
        if (adminCommands.includes(commandName) && !isOwner) {
            return await reply(`_❌ Seul le propriétaire du bot peut utiliser cette commande._`);
        }

        // ─── CONFIGURATION GLOBALE ───────────────────────────────────────────
        if (commandName === 'config') {
            const currentMode = await db.getVar('MODE', 'public');
            const antiDeleteMode = await db.getVar('ANTI_DELETE', 'chat');
            const antiEditMode = await db.getVar('ANTI_EDIT', 'chat');
            const autoStatusMode = await db.getVar('AUTO_STATUS', 'like');
            const exceptionsList = await db.getExceptions();

            let configText = `⚙️ *CONFIGURATION DU BOT*\n\n`;
            configText += `*Mode Global :* ${currentMode.toUpperCase()}\n`;
            configText += `*Auto-Status :* ${autoStatusMode.toUpperCase()}\n`;
            configText += `*Anti-Delete :* ${antiDeleteMode.toUpperCase()}\n`;
            configText += `*Anti-Edit   :* ${antiEditMode.toUpperCase()}\n\n`;
            configText += `*Exceptions (${exceptionsList.length}) :*\n`;
            if (exceptionsList.length > 0) {
                exceptionsList.forEach(e => configText += `- ${e}\n`);
            } else {
                configText += `_Aucune exception_`;
            }
            return await reply(configText);
        }

        // ─── GESTION DES EXCEPTIONS ──────────────────────────────────────────
        if (commandName === 'except') {
            const args = q.trim().split(/ +/);
            const action = args[0]?.toLowerCase();
            const target = args[1];

            if (!action || (action !== 'list' && !target)) {
                return await reply(
                    `_*Exceptions Manager*_\n_Ignore l'Anti-Delete et l'Anti-Edit pour certains chats_\n\n` +
                    `_Utilisation :_\n` +
                    `\`.except add <jid>\` - Ajouter une exception\n` +
                    `\`.except remove <jid>\` - Retirer une exception\n` +
                    `\`.except list\` - Voir les exceptions\n\n` +
                    `_Exemples de JID :_\n` +
                    `- Utilisateur : \`123456789@s.whatsapp.net\`\n` +
                    `- Groupe : \`123456-789@g.us\``
                );
            }

            if (action === 'list') {
                const exceptionsList = await db.getExceptions();
                if (exceptionsList.length === 0) return await reply(`_Aucune exception configurée._`);
                let msg = `*Liste des Exceptions :*\n\n`;
                exceptionsList.forEach(e => msg += `- ${e}\n`);
                return await reply(msg);
            }

            if (!target.includes('@')) {
                return await reply(`_Format invalide. L'ID doit contenir @s.whatsapp.net ou @g.us_`);
            }

            if (action === 'add') {
                await db.addException(target);
                return await reply(`_✅ Ajouté aux exceptions : ${target}_`);
            } else if (action === 'remove') {
                await db.removeException(target);
                return await reply(`_❌ Retiré des exceptions : ${target}_`);
            } else {
                return await reply(`_Action invalide._`);
            }
        }

        // ─── PARAMÈTRES (mode, antidelete, antiedit, autostatus) ─────────────
        if (commandName === 'autostatus') {
            let target = q.toLowerCase().trim();
            const currentStatus = await db.getVar('AUTO_STATUS', 'like');

            if (!target) {
                return await reply(
                    `_*Auto Status*_\n_Gère la lecture de statuts WhatsApp_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`.autostatus like\` - lit et like (💚) automatiquement\n` +
                    `\`.autostatus view\` - lit sans réagir\n` +
                    `\`.autostatus off\` - désactive la fonctionnalité`
                );
            }

            if (['like', 'view', 'off'].includes(target)) {
                await db.setVar('AUTO_STATUS', target);
                const emoji = target === 'like' ? '💚' : target === 'view' ? '👀' : '❌';
                return await reply(`_✅ Auto-Status configuré sur : ${target} ${emoji}_`);
            } else {
                return await reply(`_Option invalide. Tapez \`.autostatus\` pour voir l'aide._`);
            }
        }

        if (commandName === 'mode') {
            const newMode = q.toLowerCase().trim();
            if (newMode === 'public' || newMode === 'private') {
                await db.setVar('MODE', newMode);
                return await reply(`_✅ Le mode du bot a été défini sur : *${newMode}*_`);
            } else {
                const currentMode = await db.getVar('MODE', 'public');
                return await reply(`_*Mode manager*_\n_Mode actuel : ${currentMode}_\n_Utilisation : \`.mode public|private\`_`);
            }
        }

        if (commandName === 'antidelete') {
            let target = q.toLowerCase().trim();
            const currentStatus = await db.getVar('ANTI_DELETE', 'chat');

            if (!target) {
                return await reply(
                    `_*Anti delete*_\n_Récupère les messages supprimés et les renvoie_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`.antidelete chat\` - envoie dans le chat original\n` +
                    `\`.antidelete sudo\` - envoie au propriétaire (sudo)\n` +
                    `\`.antidelete <jid>\` - envoie à un numéro/groupe spécifique\n` +
                    `\`.antidelete off\` - désactive l'anti-delete`
                );
            }

            if (target === 'off') {
                await db.setVar('ANTI_DELETE', 'off');
                await db.setVar('ANTI_DELETE_JID', '');
                return await reply(`_Anti-delete désactivé ❌_`);
            } else if (target === 'chat') {
                await db.setVar('ANTI_DELETE', 'chat');
                await db.setVar('ANTI_DELETE_JID', '');
                return await reply(`_Anti-delete activé ✅ (chat d'origine)_`);
            } else if (target === 'sudo') {
                await db.setVar('ANTI_DELETE', 'sudo');
                await db.setVar('ANTI_DELETE_JID', '');
                return await reply(`_Anti-delete activé ✅ (sudo)_`);
            } else if (target.includes('@')) {
                if (!target.match(/^\d+@(s\.whatsapp\.net|g\.us)$/)) {
                    return await reply(`_Format de numéro invalide !_`);
                }
                await db.setVar('ANTI_DELETE', 'custom');
                await db.setVar('ANTI_DELETE_JID', target);
                return await reply(`_Anti-delete activé ✅ (${target})_`);
            } else {
                return await reply(`_Option invalide. Tapez \`.antidelete\` pour voir l'aide._`);
            }
        }

        if (commandName === 'antiedit') {
            let target = q.toLowerCase().trim();
            const currentStatus = await db.getVar('ANTI_EDIT', 'chat');

            if (!target) {
                return await reply(
                    `_*Anti edit*_\n_Récupère les messages modifiés et affiche l'avant/après_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`.antiedit chat\` - envoie dans le chat original\n` +
                    `\`.antiedit sudo\` - envoie au propriétaire (sudo)\n` +
                    `\`.antiedit <jid>\` - envoie à un numéro/groupe spécifique\n` +
                    `\`.antiedit off\` - désactive l'anti-edit`
                );
            }

            if (target === 'off') {
                await db.setVar('ANTI_EDIT', 'off');
                await db.setVar('ANTI_EDIT_JID', '');
                return await reply(`_Anti-edit désactivé ❌_`);
            } else if (target === 'chat') {
                await db.setVar('ANTI_EDIT', 'chat');
                await db.setVar('ANTI_EDIT_JID', '');
                return await reply(`_Anti-edit activé ✅ (chat d'origine)_`);
            } else if (target === 'sudo') {
                await db.setVar('ANTI_EDIT', 'sudo');
                await db.setVar('ANTI_EDIT_JID', '');
                return await reply(`_Anti-edit activé ✅ (sudo)_`);
            } else if (target.includes('@')) {
                if (!target.match(/^\d+@(s\.whatsapp\.net|g\.us)$/)) {
                    return await reply(`_Format de numéro invalide !_`);
                }
                await db.setVar('ANTI_EDIT', 'custom');
                await db.setVar('ANTI_EDIT_JID', target);
                return await reply(`_Anti-edit activé ✅ (${target})_`);
            } else {
                return await reply(`_Option invalide. Tapez \`.antiedit\` pour voir l'aide._`);
            }
        }

        // ─── VU UNIQUE (viewonce) ─────────────────────────────────────────────
        if (commandName === 'vv' || commandName === 'viewonce') {
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const quotedMsg = context?.quotedMessage;

            if (!quotedMsg) {
                return await reply(`_Réponds à un message en vue unique avec \`.vv\`_`);
            }

            // Baileys V7 : plusieurs formats possibles pour un viewOnce
            // On cherche l'imageMessage / videoMessage dans tous les wrappers possibles
            const voWrappers = [
                quotedMsg.viewOnceMessage?.message,
                quotedMsg.viewOnceMessageV2?.message,
                quotedMsg.viewOnceMessageV2Extension?.message,
                quotedMsg, // parfois le quotedMsg contient directement le media
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

        // ─── STICKERS ────────────────────────────────────────────────────────
        if (['sticker', 's', 'crop'].includes(commandName)) {
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

                const tempDir = path.join(__dirname, 'temp');
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

        // ─── TAGALL ──────────────────────────────────────────────────────────
        if (commandName === 'tagall') {
            if (!from.endsWith('@g.us')) return await reply(`_Cette commande est réservée aux groupes._`);
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            const groupMeta = await sock.groupMetadata(from);
            const members = groupMeta.participants;
            let text = q ? `📢 *${q}*\n\n` : `📢 *Attention tout le monde !*\n\n`;
            const mentions = members.map(m => m.id);
            members.forEach(m => { text += `@${m.id.split('@')[0]}\n`; });
            await sock.sendMessage(from, { text, mentions });
        }

        // ─── KICK ────────────────────────────────────────────────────────────
        if (commandName === 'kick') {
            if (!from.endsWith('@g.us')) return await reply(`_Cette commande est réservée aux groupes._`);
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            const targetJid = msg.message?.extendedTextMessage?.contextInfo?.participant
                           || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!targetJid) return await reply(`_Réponds au message de la personne à expulser, ou mentionnes-la._`);
            try {
                await sock.groupParticipantsUpdate(from, [targetJid], 'remove');
                await reply(`_✅ @${targetJid.split('@')[0]} a été expulsé du groupe._`, { mentions: [targetJid] });
            } catch (e) {
                await reply(`_❌ Impossible d'expulser : assure-toi que le bot est admin._`);
            }
        }

        // ─── POLL ────────────────────────────────────────────────────────────
        if (commandName === 'poll' || commandName === 'sondage') {
            const parts = q.split('|').map(s => s.trim()).filter(Boolean);
            if (parts.length < 3) {
                return await reply(`_Utilisation : \`.poll Question|Option1|Option2\`_`);
            }
            const [question, ...options] = parts;
            await sock.sendMessage(from, {
                poll: {
                    name: question,
                    values: options,
                    selectableCount: 1
                }
            });
        }

        // ─── CALC ────────────────────────────────────────────────────────────
        if (commandName === 'calc') {
            if (!q) return await reply(`_Utilisation : \`.calc 2+2*5\`_`);
            try {
                // Sécurisé : on évalue uniquement les expressions mathématiques
                const sanitized = q.replace(/[^0-9+\-*/().,\s%^]/g, '');
                if (sanitized !== q.replace(/\s/g, '')) return await reply(`_❌ Expression invalide ou non-autorisée._`);
                const result = Function(`"use strict"; return (${sanitized})`)();
                await reply(`🧮 *${q}* = \`${result}\``);
            } catch (e) {
                await reply(`_❌ Expression invalide._`);
            }
        }

        // ─── WIKIPEDIA ───────────────────────────────────────────────────────
        if (commandName === 'wiki' || commandName === 'wikipedia') {
            if (!q) return await reply(`_Utilisation : \`.wiki <sujet>\`_`);
            try {
                const res = await axios.get(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, {
                    headers: { 'User-Agent': 'WhatsAppBot/1.0 (bot@example.com)' }
                });
                const data = res.data;
                if (!data.extract) return await reply(`_Aucun résultat pour "${q}"._`);
                const text = `📚 *${data.title}*\n\n${data.extract.slice(0, 700)}...\n\n🔗 ${data.content_urls?.desktop?.page || ''}`;
                await reply(text);
            } catch (e) {
                console.log(chalk.red('[.wiki] Erreur :'), e.message);
                await reply(`_❌ Aucun résultat pour "${q}". (${e.message})_`);
            }
        }

        // ─── CITATION ────────────────────────────────────────────────────────
        if (commandName === 'quote' || commandName === 'citation') {
            try {
                const res = await axios.get('https://quoteslate.vercel.app/api/quotes/random');
                const { quote, author } = res.data;
                await reply(`💬 _"${quote}"_\n\n— *${author}*`);
            } catch (e) {
                // Fallback citations locales
                const fallback = [
                    ['La vie, c\'est comme une bicyclette, il faut avancer pour ne pas perdre l\'équilibre.', 'Albert Einstein'],
                    ['Le succès c\'est tomber sept fois, se relever huit.', 'Proverbe japonais'],
                    ['L\'imagination est plus importante que la connaissance.', 'Albert Einstein'],
                    ['Ce qui ne me tue pas me rend plus fort.', 'Friedrich Nietzsche'],
                ];
                const [quote, author] = fallback[Math.floor(Math.random() * fallback.length)];
                await reply(`💬 _"${quote}"_\n\n— *${author}*`);
            }
        }

        // ─── TRADUCTION ──────────────────────────────────────────────────────
        if (commandName === 'translate' || commandName === 'tr') {
            const parts = q.split(' ');
            const lang = parts[0];
            const text = parts.slice(1).join(' ');
            if (!lang || !text) return await reply(`_Utilisation : \`.translate en Bonjour monde\`_\n_Codes : fr, en, es, de, ar, pt, ru..._`);
            try {
                const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${lang}`);
                const translation = res.data.responseData.translatedText;
                await reply(`🌐 *Traduction → ${lang.toUpperCase()}*\n\n${translation}`);
            } catch (e) {
                console.log(chalk.red('[.translate] Erreur :'), e.message);
                await reply(`_❌ Impossible de traduire._`);
            }
        }

        // ─── REMIND ──────────────────────────────────────────────────────────
        if (commandName === 'remind' || commandName === 'rappel') {
            const parts = q.split(' ');
            const delayStr = parts[0]; // ex: 30m, 2h
            const message = parts.slice(1).join(' ');
            if (!delayStr || !message) return await reply(`_Utilisation : \`.remind 30m penser à appeler\`_\n_Unités : m (minutes), h (heures)_`);
            const match = delayStr.match(/^(\d+)(m|h)$/i);
            if (!match) return await reply(`_Format invalide. Ex: 30m ou 2h_`);
            const ms = parseInt(match[1]) * (match[2].toLowerCase() === 'h' ? 3600000 : 60000);
            if (ms > 24 * 3600000) return await reply(`_❌ Maximum 24 heures._`);
            await reply(`_⏰ Rappel programmé dans ${delayStr} !_`);
            setTimeout(async () => {
                await sock.sendMessage(from, { text: `⏰ *RAPPEL :* ${message}` }, { quoted: msg });
            }, ms);
        }

        // ─── WARN / WARNINGS / RESETWARN ───────────────────────────────────
        if (commandName === 'warn') {
            if (!from.endsWith('@g.us')) return await reply(`_Réservé aux groupes._`);
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            const targetJid = msg.message?.extendedTextMessage?.contextInfo?.participant
                           || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!targetJid) return await reply(`_Réponds au message de la personne à avertir._`);
            const count = await db.addWarning(targetJid, from);
            const MAX_WARNS = 3;
            if (count >= MAX_WARNS) {
                await reply(`_⚠️ @${targetJid.split('@')[0]} a atteint ${MAX_WARNS} avertissements. Expulsion !_`, { mentions: [targetJid] });
                try {
                    await sock.groupParticipantsUpdate(from, [targetJid], 'remove');
                    await db.resetWarnings(targetJid, from);
                } catch (e) { /* pas admin */ }
            } else {
                await reply(`_⚠️ @${targetJid.split('@')[0]} : ${count}/${MAX_WARNS} avertissements._\n${q ? `_Raison : ${q}_` : ''}`, { mentions: [targetJid] });
            }
        }

        if (commandName === 'warnings') {
            if (!from.endsWith('@g.us')) return;
            const targetJid = msg.message?.extendedTextMessage?.contextInfo?.participant
                           || (q ? `${q.replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
            if (!targetJid) return await reply(`_Réponds ou mentionne quelqu'un._`);
            const count = await db.getWarnings(targetJid, from);
            await reply(`_@${targetJid.split('@')[0]} a ${count}/3 avertissement(s) dans ce groupe._`, { mentions: [targetJid] });
        }

        if (commandName === 'resetwarn') {
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            const targetJid = msg.message?.extendedTextMessage?.contextInfo?.participant
                           || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!targetJid) return await reply(`_Réponds ou mentionne quelqu'un._`);
            await db.resetWarnings(targetJid, from);
            await reply(`_✅ Avertissements de @${targetJid.split('@')[0]} réinitialisés._`, { mentions: [targetJid] });
        }

        // ─── ANTILINK ────────────────────────────────────────────────────────
        if (commandName === 'antilink') {
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            const target = q.toLowerCase().trim();
            if (!target) {
                const current = await db.getVar('ANTI_LINK', 'off');
                return await reply(`_*Anti-Link*_\n_Supprime automatiquement les liens dans les groupes_\n\n_Statut actuel : ${current}_\n\n\`.antilink on\` — activer\n\`.antilink off\` — désactiver`);
            }
            if (target === 'on' || target === 'off') {
                await db.setVar('ANTI_LINK', target);
                return await reply(`_Anti-link ${target === 'on' ? 'activé ✅' : 'désactivé ❌'}_`);
            }
            return await reply(`_Option invalide : \`on\` ou \`off\`_`);
        }

        // ─── BLACKLIST ───────────────────────────────────────────────────────
        if (commandName === 'blacklist') {
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            const args = q.trim().split(' ');
            const action = args[0]?.toLowerCase();
            const word = args.slice(1).join(' ').toLowerCase();

            if (action === 'add' && word) {
                await db.addBlacklistWord(word);
                return await reply(`_✅ Le mot "${word}" a été ajouté à la blacklist._`);
            } else if (action === 'remove' && word) {
                await db.removeBlacklistWord(word);
                return await reply(`_✅ Le mot "${word}" a été retiré de la blacklist._`);
            } else if (action === 'list') {
                const words = await db.getBlacklistWords();
                if (words.length === 0) return await reply(`_La blacklist est vide._`);
                return await reply(`_*Mots Interdits :*_\n${words.map(w => `- ${w}`).join('\n')}`);
            } else {
                return await reply(`_Utilisation :_\n\`.blacklist add <mot>\`\n\`.blacklist remove <mot>\`\n\`.blacklist list\``);
            }
        }

        // ─── NOUVELLES COMMANDES CRÉATIVES (15) ──────────────────────────────
        // 1. Promote
        if (commandName === 'promote') {
            if (!from.endsWith('@g.us')) return await reply(`_⚠️ Réservé aux groupes._`);
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            const target = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) return await reply(`_Réponds ou mentionne l'utilisateur._`);
            try {
                await sock.groupParticipantsUpdate(from, [target], 'promote');
                await reply(`_✅ @${target.split('@')[0]} est maintenant administrateur._`, { mentions: [target] });
            } catch (e) { await reply(`_❌ Erreur, le bot est-il admin ?_`); }
        }

        // 2. Demote
        if (commandName === 'demote') {
            if (!from.endsWith('@g.us')) return await reply(`_⚠️ Réservé aux groupes._`);
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            const target = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) return await reply(`_Réponds ou mentionne l'utilisateur._`);
            try {
                await sock.groupParticipantsUpdate(from, [target], 'demote');
                await reply(`_✅ @${target.split('@')[0]} n'est plus administrateur._`, { mentions: [target] });
            } catch (e) { await reply(`_❌ Erreur, le bot est-il admin ?_`); }
        }

        // 3. Group Open/Close
        if (commandName === 'group' || commandName === 'groupe') {
            if (!from.endsWith('@g.us')) return await reply(`_⚠️ Réservé aux groupes._`);
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            if (q === 'open' || q === 'ouvert') {
                await sock.groupSettingUpdate(from, 'not_announcement');
                await reply(`_🔓 Le groupe est ouvert à tous les membres._`);
            } else if (q === 'close' || q === 'fermé') {
                await sock.groupSettingUpdate(from, 'announcement');
                await reply(`_🔒 Le groupe est fermé. Seuls les admins peuvent parler._`);
            } else {
                await reply(`_Utilisation : \`.group open\` ou \`.group close\`_`);
            }
        }

        // 4. SetDesc
        if (commandName === 'setdesc') {
            if (!from.endsWith('@g.us')) return await reply(`_⚠️ Réservé aux groupes._`);
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            if (!q) return await reply(`_Texte manquant._`);
            try {
                await sock.groupUpdateDescription(from, q);
                await reply(`_✅ Description mise à jour avec succès._`);
            } catch (e) { await reply(`_❌ Impossible de modifier la description._`); }
        }

        // 5. Link (Lien d'invitation)
        if (commandName === 'link' || commandName === 'lien') {
            if (!from.endsWith('@g.us')) return await reply(`_⚠️ Réservé aux groupes._`);
            try {
                const code = await sock.groupInviteCode(from);
                await reply(`_🔗 Lien du groupe :_\nhttps://chat.whatsapp.com/${code}`);
            } catch (e) { await reply(`_❌ Impossible d'obtenir le lien (le bot doit être admin)._`); }
        }

        // 6. Hidetag (Tag furtif)
        if (commandName === 'hidetag') {
            if (!from.endsWith('@g.us')) return await reply(`_⚠️ Cette commande est réservée aux groupes._`);
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            const groupMeta = await sock.groupMetadata(from);
            const members = groupMeta.participants.map(m => m.id);
            await sock.sendMessage(from, { text: q || '\u200B', mentions: members });
        }

        // 7. Météo
        if (commandName === 'weather' || commandName === 'meteo') {
            if (!q) return await reply(`_Veuillez indiquer une ville. Ex: \`.météo Paris\`_`);
            try {
                const res = await axios.get(`https://wttr.in/${encodeURIComponent(q)}?format=%l:+%C+%t+(Ressenti:+%f)\n💧+Humidité:+%h\n💨+Vent:+%w`);
                await reply(`🌤️ *Météo* :\n\n${res.data}`);
            } catch (e) {
                await reply(`_❌ Impossible de récupérer la météo pour "${q}"._`);
            }
        }

        // 8. QRCode
        if (commandName === 'qr' || commandName === 'qrcode') {
            if (!q) return await reply(`_Indiquez un texte ou un lien. Ex: \`.qr Coucou\`_`);
            try {
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(q)}`;
                await sock.sendMessage(from, { image: { url: qrUrl }, caption: `_📱 QRCode généré pour :_ ${q}` }, { quoted: msg });
            } catch (e) { await reply(`_❌ Erreur de génération QRCode._`); }
        }

        // 9. Text-To-Speech (TTS)
        if (commandName === 'tts') {
            const args = q.split(' ');
            let lang = 'fr';
            let text = q;
            if (args[0]?.length === 2 && args.length > 1) { // ex: .tts en Hello
                lang = args[0];
                text = args.slice(1).join(' ');
            }
            if (!text) return await reply(`_Texte manquant. Ex: \`.tts fr Bonjour\`_`);
            try {
                const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${lang}&q=${encodeURIComponent(text)}`;
                await sock.sendMessage(from, { audio: { url: ttsUrl }, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg });
            } catch(e) { await reply(`_❌ Erreur TTS._`); }
        }

        // 10. URL Shortener
        if (commandName === 'short' || commandName === 'shorturl') {
            if (!q || !q.startsWith('http')) return await reply(`_Lien invalide. Ex: \`.short https://exemple.com\`_`);
            try {
                const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(q)}`);
                await reply(`_🔗 Lien raccourci :_ ${res.data}`);
            } catch (e) { await reply(`_❌ Impossible de raccourcir ce lien._`); }
        }

        // 11. GitHub stats
        if (commandName === 'github') {
            if (!q) return await reply(`_Indiquez un username. Ex: \`.github torvalds\`_`);
            try {
                const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(q)}`);
                const user = res.data;
                const txt = `🐙 *GITHUB : ${user.login}*\n\n👤 *Nom :* ${user.name || 'N/A'}\n📝 *Bio :* ${user.bio || 'N/A'}\n📦 *Dépôts :* ${user.public_repos}\n👥 *Abonnés :* ${user.followers}\n🔗 *Lien :* ${user.html_url}`;
                if (user.avatar_url) {
                    await sock.sendMessage(from, { image: { url: user.avatar_url }, caption: txt }, { quoted: msg });
                } else await reply(txt);
            } catch (e) { await reply(`_❌ Utilisateur GitHub introuvable._`); }
        }

        // 12. Blagues
        if (commandName === 'joke' || commandName === 'blague') {
            const jokes = [
                "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ?\nParce que sinon ils tombent dans le bateau.",
                "Que fait une fraise sur un cheval ?\nDu tagada tagada !",
                "C'est l'histoire d'un pingouin qui respire par les fesses. Un jour il s'assoit et il meurt.",
                "Pourquoi les plongeurs sous-marins ont-ils des appareils photos ?\nParce que les requins aiment les clichés.",
                "Quel est le comble pour un électricien ?\nDe ne pas être au courant."
            ];
            const joke = jokes[Math.floor(Math.random() * jokes.length)];
            await reply(`😂 *Blague* : \n\n${joke}`);
        }

        // 13. Dice (Jet de dé)
        if (commandName === 'dice' || commandName === 'dé') {
            const result = Math.floor(Math.random() * 6) + 1;
            await reply(`🎲 *Lancé de dé...*\n\nTu as obtenu : *${result}* !`);
        }

        // 14. Love meter
        if (commandName === 'love' || commandName === 'amour') {
            const args = q.split(' ');
            if (args.length < 2) return await reply(`_Utilisation : \`.love Roméo Juliette\`_`);
            const name1 = args[0];
            const name2 = args.slice(1).join(' ');
            const score = Math.floor(Math.random() * 101); // 0-100
            let emoji = score > 80 ? '💖' : score > 50 ? '💕' : score > 20 ? '💔' : '☠️';
            await reply(`🔮 *Calculateur d'Amour* 🔮\n\n${name1} + ${name2} = *${score}%* ${emoji}`);
        }

        // 15. System (Uptime & RAM)
        if (commandName === 'system' || commandName === 'sys') {
            const os = require('os');
            const uptime = process.uptime();
            const formatUptime = (sec) => {
                const h = Math.floor(sec / 3600);
                const m = Math.floor((sec % 3600) / 60);
                return `${h}h ${m}m`;
            };
            const ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
            const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
            await reply(`⚙️ *SYSTÈME BOT*\n\n⏱️ *Uptime :* ${formatUptime(uptime)}\n🖥️ *RAM Utilisée :* ${ramUsage} MB\n💾 *RAM Serveur :* ${totalRam} GB\n⚡ *Node.js :* ${process.version}`);
        }

        // 16. JID (Trouver le JID d'un utilisateur ou du groupe)
        if (commandName === 'jid') {
            const targetJid = msg.message?.extendedTextMessage?.contextInfo?.participant
                           || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            
            if (targetJid) {
                await reply(`_JID :_ \`${targetJid}\``);
            } else if (from.endsWith('@g.us')) {
                await reply(`_JID du groupe :_ \`${from}\``);
            } else {
                await reply(`_Ton JID :_ \`${from}\``);
            }
        }

        // 17. Mise à jour automatique GitHub
        if (commandName === 'update') {
            if (!isOwner) return await reply(`_❌ Seul le propriétaire peut lancer une mise à jour distante._`);
            await reply(`_⏳ Vérification des mises à jour sur GitHub..._`);
            
            exec('git pull origin main', async (error, stdout, stderr) => {
                const output = stdout.trim() || stderr.trim();
                
                if (error && !output.includes('Already up to date')) {
                    console.log(chalk.red('Erreur Git Pull:'), error.message);
                    return await reply(`_❌ Échec de la mise à jour._\n\n\`\`\`${output}\`\`\``);
                }
                
                if (output.includes('Already up to date')) {
                    return await reply(`_✅ Le bot est déjà sur la version la plus récente._`);
                }
                
                await reply(`_🚀 Mise à jour téléchargée avec succès._\n\n\`\`\`${output}\`\`\`\n\n_Redémarrage en cours (Patientez 5 secondes)..._`);
                
                // Prévenir le bot qu'il doit envoyer un message après le redémarrage
                await db.setVar('UPDATE_PENDING', from);

                // Quitter proprement pour que PM2 relance le bot
                setTimeout(() => process.exit(0), 1000);
            });
        }

        // 18. Commandes SaaS (SuperAdmin)
        if (commandName === 'session') {
            if (!isMasterAdmin) return await reply(`_❌ Commande strictement réservée au Maître._`);
            if (!q) return await reply(`_⚠️ Précise un numéro pour générer son espace de sous-bot. Ex: \`.session 33612345678\`_`);
            const subNum = q.replace(/[^0-9]/g, '');
            if (subNum.length < 10) return await reply(`_❌ Numéro invalide._`);
            
            await reply(`_⏳ Démarrage d'une structure serveur isolée pour le ${subNum}..._\n_Veuillez patienter..._`);
            
            try {
                const { startBot } = require('./index');
                // On allume le sous-bot temporairement de force
                const subSock = await startBot('user_' + subNum, false, subNum);
                
                setTimeout(async () => {
                    try {
                        const code = await subSock.requestPairingCode(subNum);
                        const formatted = code.match(/.{1,4}/g).join('-');
                        await reply(`✅ *SOUS-BOT PRÉPARÉ*\n\nVoici le code secret pour que le client connecte ce nouveau bot chez lui :\n\n👉 *${formatted}*\n\n_Le client doit aller sur WhatsApp > Appareils Liés > Lier avec numéro._\n\n_Une fois entré, son bot s'allumera définitivement sans jamais toucher au tiens !_`);
                    } catch (e) {
                         await reply(`_❌ Erreur lors de la génération du code : (Il faut parfois réessayer) ${e.message}_`);
                    }
                }, 4000);
            } catch (e) {
                await reply(`_❌ Erreur lancement instance : ${e.message}_`);
            }
        }

        if (commandName === 'listbots') {
            if (!isMasterAdmin) return;
            const sessionsMap = global.activeSessions;
            if (!sessionsMap || sessionsMap.size === 0) return await reply(`_Aucun bot actuellement en ligne._`);
            
            let txt = `🌐 *LISTE DES INSTANCES SAAS (${sessionsMap.size})*\n\n`;
            for (const [sid, sSock] of sessionsMap.entries()) {
                const isM = sSock.isMaster ? '👑 MASTER' : '🤖 CLIENT';
                txt += `🔹 *ID:* ${sid}\n   *Type:* ${isM}\n   *Propriétaire:* ${sSock.customOwner || 'Aucun'}\n\n`;
            }
            await reply(txt);
        }

        if (commandName === 'delbot') {
            if (!isMasterAdmin) return;
            if (!q) return await reply(`_Précisez l'ID entier du bot à supprimer. (Ex: \`.delbot user_33612345678\`)_`);
            const targetId = q.trim();
            if (targetId === 'master') return await reply(`_❌ Tu ne peux pas te supprimer toi-même !_`);
            
            const sessionsMap = global.activeSessions;
            if (sessionsMap && sessionsMap.has(targetId)) {
                try {
                    const sSock = sessionsMap.get(targetId);
                    await sSock.logout(); // Déconnecte l'appareil lié de son whatsapp
                    sessionsMap.delete(targetId);
                    const sessionFolder = require('path').join(__dirname, 'sessions', targetId);
                    if (require('fs').existsSync(sessionFolder)) {
                        require('fs').rmSync(sessionFolder, { recursive: true, force: true });
                    }
                    await reply(`_✅ Le client **${targetId}** a été déconnecté pour toujours et ses données effacées du VPS._`);
                } catch(e) {
                    await reply(`_❌ Erreur de suppression : ${e.message}_`);
                }
            } else {
                await reply(`_❌ Bot introuvable._`);
            }
        }

        if (commandName === 'restartbot') {
            if (!isMasterAdmin) return;
            if (!q) return await reply(`_Précisez l'ID du bot (ex: user_336... ou master)._`);
            const targetId = q.trim();
            const sessionsMap = global.activeSessions;
            if (sessionsMap && sessionsMap.has(targetId)) {
                try {
                    const sSock = sessionsMap.get(targetId);
                    sSock.end(new Error('Restart Requested')); // Force la déconnexion
                    await reply(`_✅ Le bot **${targetId}** est en train de redémarrer..._`);
                } catch(e) {
                    await reply(`_❌ Erreur: ${e.message}_`);
                }
            } else {
                await reply(`_❌ Bot introuvable en mémoire._`);
            }
        }

        if (commandName === 'logs') {
            if (!isMasterAdmin) return;
            if (!q) return await reply(`_Précisez l'ID (ex: user_336... ou master)_`);
            const targetId = q.trim();
            try {
                const logPath = require('path').join(__dirname, 'logs', 'out.log');
                if (!require('fs').existsSync(logPath)) return await reply(`_Fichier log inexistant._`);
                // Lire les 15000 derniers caractères pour économiser la RAM
                const stats = require('fs').statSync(logPath);
                const startPos = Math.max(0, stats.size - 15000);
                let buffer = Buffer.alloc(15000);
                const fd = require('fs').openSync(logPath, 'r');
                const bytesRead = require('fs').readSync(fd, buffer, 0, 15000, startPos);
                require('fs').closeSync(fd);
                
                const lines = buffer.toString('utf-8', 0, bytesRead).split('\n');
                const filtered = lines.filter(l => l.includes(`[${targetId}]`));
                const lastLines = filtered.slice(-15).join('\n');
                
                if (!lastLines) return await reply(`_Aucun log trouvé pour ${targetId}._`);
                await reply(`📄 *LOGS - ${targetId}*\n\n\`\`\`\n${lastLines}\n\`\`\``);
            } catch (e) {
                await reply(`_❌ Erreur lecture logs : ${e.message}_`);
            }
        }

        // ─── MENU & AIDE ─────────────────────────────────────────────────────
        if (commandName === 'menu' || commandName === 'help') {
            const targetCmd = q.toLowerCase().trim();

            if (targetCmd) {
                const helps = {
                    'antidelete': `*AIDE : .antidelete*\n\n_Récupère les messages supprimés avant que quiconque ne s'en rende compte._\n\n*Options :*\n- \`.antidelete chat\` : Renvoyer le message dans le même groupe.\n- \`.antidelete sudo\` : T'envoyer le message en privé discrètement.\n- \`.antidelete <numero>@s.whatsapp.net\` : Envoyer à un ami spécifique.\n- \`.antidelete off\` : Désactiver.\n\n_⚠️ L'Owner et les exceptions de .except sont immunisés._`,
                    'antiedit': `*AIDE : .antiedit*\n\n_Traque les modifications de messages et dévoile l'Avant/Après._\n\n*Options :*\n- \`.antiedit chat\`, \`.antiedit sudo\`, \`.antiedit <jid>\`, \`.antiedit off\``,
                    'except': `*AIDE : .except*\n\n_Liste noire de l'Anti-Delete et Anti-Edit._\n\n- \`.except add <jid>\` : Ignorer un numéro/groupe.\n- \`.except remove <jid>\` : Retirer l'immunité.\n- \`.except list\` : Voir tous les immunisés.`,
                    'mode': `*AIDE : .mode*\n\n- \`.mode public\` : Commandes ouvertes à tous.\n- \`.mode private\` : Seul le propriétaire interagit avec le bot.`,
                    'autostatus': `*AIDE : .autostatus*\n\n- \`.autostatus like\` : Lire + liker 💚 tous les statuts.\n- \`.autostatus view\` : Lire sans réagir.\n- \`.autostatus off\` : Désactivé.`,
                    'config': `*AIDE : .config*\n\n_Affiche un tableau de bord de l'état actuel (mode, antilink, statuts, exceptions...)._`,
                    'sticker': `*AIDE : .sticker (ou .s)*\n\n_Réponds à une image/vidéo (max 10s) et tape la commande. L'image garde ses proportions originales._`,
                    'crop': `*AIDE : .crop*\n\n_Comme .sticker, mais découpe l'image en un carré parfait centré (style plein écran)._`,
                    'play': `*AIDE : .play*\n\n_Cherche et envoie une musique YouTube.\n\`.play <titre ou lien YouTube>\`_`,
                    'tagall': `*AIDE : .tagall*\n\n_Mentionne tous les membres d'un groupe.\n\`.tagall [message facultatif]\`_`,
                    'kick': `*AIDE : .kick*\n\n_Expulse un membre (répondre à son message).\nLe bot doit être admin._`,
                    'poll': `*AIDE : .poll*\n\n_Crée un sondage natif WhatsApp.\n\`.poll Question|Option1|Option2|Option3\`_`,
                    'calc': `*AIDE : .calc*\n\n_Calculatrice instantanée.\n\`.calc (12+5)*3\`_`,
                    'wiki': `*AIDE : .wiki*\n\n_Résumé Wikipedia en français.\n\`.wiki Elon Musk\`_`,
                    'quote': `*AIDE : .quote*\n\n_Affiche une citation inspirante aléatoire._`,
                    'translate': `*AIDE : .translate (ou .tr)*\n\n_Traduit un texte.\n\`.translate en Bonjour tout le monde\`\n\`.translate ar Merci beaucoup\`_`,
                    'remind': `*AIDE : .remind*\n\n_Programme un rappel.\n\`.remind 30m prendre médicament\`\n\`.remind 2h appeler maman\`_`,
                    'warn': `*AIDE : .warn*\n\n_Avertit un membre (répondre à son message).\nÀ 3 warns = expulsion automatique._`,
                    'antilink': `*AIDE : .antilink*\n\n_Active ou désactive la suppression automatique des liens dans les groupes.\n\`.antilink on\` / \`.antilink off\`_`,
                    'blacklist': `*AIDE : .blacklist*\n\n_Gère la liste des mots interdits. Si un message contient ce mot, il est supprimé automatiquement._\n\n*Options:*\n- \`.blacklist add <mot>\`\n- \`.blacklist remove <mot>\`\n- \`.blacklist list\``,
                    'vv': `*AIDE : .vv*\n\n_Révèle un message en vue unique.\nRéponds au message avec \`.vv\`._`,
                    'hidetag': `*AIDE : .hidetag*\n\n_Sonne tous les membres d'un groupe mais le message ne montre pas de longs tags visuels._`,
                    'tts': `*AIDE : .tts*\n\n_Transforme du texte en audio (Text-to-Speech)._\n_Ex: \`.tts fr Salut\` ou \`.tts en Hello\`._`,
                    'jid': `*AIDE : .jid*\n\n_Obtient le JID (identifiant WhatsApp) d'un utilisateur ou d'un groupe.\nObtiens le JID d'une mention, en répondant à un message, ou tape juste \`.jid\`._`,
                    'update': `*AIDE : .update*\n\n_Connecte le bot à GitHub pour télécharger le tout dernier code source et se redémarre tout seul._\n\n_⚠️ Uniquement pour le propriétaire et sur VPS avec PM2._`,
                };

                const helpText = helps[targetCmd.replace('.', '')] || helps[targetCmd];
                if (helpText) return await reply(helpText);
                return await reply(`_Aucune aide pour \`${targetCmd}\`. Tape \`.help\` pour voir toutes les commandes._`);
            }

            // Menu Principal
            const aliases = ['play', 'song', 'yta', 'mp3', 'music'];
            const currentMode = await db.getVar('MODE', 'public');
            const antiDeleteMode = await db.getVar('ANTI_DELETE', 'chat');
            const antiEditMode = await db.getVar('ANTI_EDIT', 'chat');

            let menuText = `┌─── 「  *𝐒𝐏𝐈𝐑𝐈𝐓-𝐌𝐃*  」 ───\n`;
            menuText += `│ 👤 *Propriétaire:* Ouédraogo Fabrice\n`;
            menuText += `│ ⚙️ *Mode:* ${currentMode}\n`;
            menuText += `└─────────────────────\n\n`;

            menuText += `✦ 𝗠𝗢𝗗𝗘𝗥𝗔𝗧𝗜𝗢𝗡\n`;
            menuText += `  .kick • .warn • .warnings • .resetwarn\n`;
            menuText += `  .promote • .demote • .group\n\n`;

            menuText += `✦ 𝗖𝗢𝗡𝗙𝗜𝗚\n`;
            menuText += `  .mode • .antilink • .blacklist\n`;
            menuText += `  .antidelete • .antiedit\n\n`;

            menuText += `✦ 𝗠𝗘𝗗𝗜𝗔𝗦\n`;
            menuText += `  .sticker • .play • .tts • .vv\n\n`;

            menuText += `✦ 𝗨𝗧𝗜𝗟𝗦\n`;
            menuText += `  .wiki • .weather • .calc • .translate\n`;
            menuText += `  .remind • .jid • .hidetag\n\n`;

            menuText += `✦ 𝗙𝗨𝗡\n`;
            menuText += `  .joke • .dice • .love • .quote\n\n`;

            if (isMasterAdmin) {
                menuText += `✦ 𝗦𝗨𝗣𝗘𝗥𝗔𝗗𝗠𝗜𝗡 𝗦𝗔𝗔𝗦\n`;
                menuText += `  .session • .listbots\n`;
                menuText += `  .delbot • .restartbot • .logs\n\n`;
            }

            menuText += `_💡 Plus d'infos : \`.help <commande>\`_`;

            await reply(menuText);
        }


    } catch (err) {
        console.error(chalk.red('Erreur commande :'), err);
    }
};
