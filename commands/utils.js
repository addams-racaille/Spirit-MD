const axios = require('axios');
const chalk = require('chalk');
const db = require('../db');

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

module.exports = [
    {
        name: 'msgs',
        groupOnly: true,
        desc: 'Affiche un classement détaillé et les statistiques des membres les plus bavards du groupe.',
        usage: '.msgs',
        execute: async (ctx) => {
            const { from, sock, msg, reply } = ctx;
            const stats = await db.fetchFromStore(from);
            if (stats.length === 0) return await reply("_Aucun message enregistré dans ce groupe._");
            
            stats.sort((a, b) => b.totalMessages - a.totalMessages);
            
            let final_msg = `📊 *MESSAGES DU GROUPE*\n_(${stats.length} membres actifs)_\n\n`;
            for (let stat of stats.slice(0, 50)) {
                let userJid = stat.jid;
                let count = stat.totalMessages;
                let name = stat.name || "Inconnu";
                let lastMsg = timeSince(stat.lastMessageAt);
                
                final_msg += `👤 *${name}* (@${userJid.split('@')[0]})\n`;
                final_msg += `💬 Total : ${count} | 🕒 Vu: ${lastMsg}\n\n`;
            }
            
            await sock.sendMessage(from, { text: final_msg, mentions: stats.map(s => s.jid) }, { quoted: msg });
        }
    },
    {
        name: 'users',
        desc: 'Dresse le top 10 des VIP du serveur ayant posté le plus gros de messages.',
        usage: '.users [global] [limite]',
        execute: async (ctx) => {
            const { q, from, sock, msg, reply } = ctx;
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
    },
    {
        name: 'tagall',
        groupOnly: true,
        masterOnly: true, 
        desc: 'Notifie brutalement jusqu\'au fond de la couette tous les membres présents dans le groupe.',
        usage: '.tagall [VOTRE MESSAGE]',
        execute: async (ctx) => {
            const { q, from, sock, isOwner, reply } = ctx;
            if (!isOwner) return await reply(`_❌ Réservé au propriétaire._`);
            const groupMeta = await sock.groupMetadata(from);
            const members = groupMeta.participants;
            let text = q ? `📢 *${q}*\n\n` : `📢 *Attention tout le monde !*\n\n`;
            const mentions = members.map(m => m.id);
            members.forEach(m => { text += `@${m.id.split('@')[0]}\n`; });
            await sock.sendMessage(from, { text, mentions });
        }
    },
    {
        name: 'poll',
        aliases: ['sondage'],
        desc: 'Génère un sondage interactif et natif WhatsApp avec des options de votes précis.',
        usage: '.poll Question|Option 1|Option 2|Option 3',
        execute: async (ctx) => {
            const { q, sock, from, reply } = ctx;
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
    },
    {
        name: 'calc',
        desc: 'Calculatrice scientifique en temps réel qui évalue proprement vos équations.',
        usage: '.calc <1+2*8>',
        execute: async (ctx) => {
            const { q, reply } = ctx;
            if (!q) return await reply(`_Utilisation : \`.calc 2+2*5\`_`);
            try {
                const sanitized = q.replace(/[^0-9+\-*/().,\s%^]/g, '');
                if (sanitized !== q.replace(/\s/g, '')) return await reply(`_❌ Expression invalide ou non-autorisée._`);
                const result = Function(`"use strict"; return (${sanitized})`)();
                await reply(`🧮 *${q}* = \`${result}\``);
            } catch (e) {
                await reply(`_❌ Expression invalide._`);
            }
        }
    },
    {
        name: 'wiki',
        aliases: ['wikipedia'],
        desc: 'Lance une recherche Wikipédia sur un sujet ou un mot et affiche son résumé.',
        usage: '.wiki <terme de recherche>',
        execute: async (ctx) => {
            const { q, reply } = ctx;
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
    },
    {
        name: 'translate',
        aliases: ['tr'],
        desc: 'Traduit instantanément votre bloc de texte brut dans n\'importe quelle langue mondiale.',
        usage: '.translate <code de langue> <votre texte>',
        execute: async (ctx) => {
            const { q, reply } = ctx;
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
    },
    {
        name: 'remind',
        aliases: ['rappel'],
        desc: 'Conçois une alerte minutée : le bot t\'enverra un message en temps voulu !',
        usage: '.remind <durée(10m/3h)> <texte rappelé>',
        execute: async (ctx) => {
            const { q, sock, from, msg, reply } = ctx;
            const parts = q.split(' ');
            const delayStr = parts[0]; 
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
    },
    {
        name: 'weather',
        aliases: ['meteo'],
        desc: 'Télécharge une carte détaillée de la température et prévisions de la ville demandée.',
        usage: '.weather <Paris/Montreal/etc>',
        execute: async (ctx) => {
            const { q, reply } = ctx;
            if (!q) return await reply(`_Veuillez indiquer une ville. Ex: \`.météo Paris\`_`);
            try {
                const res = await axios.get(`https://wttr.in/${encodeURIComponent(q)}?format=%l:+%C+%t+(Ressenti:+%f)\n💧+Humidité:+%h\n💨+Vent:+%w`);
                await reply(`🌤️ *Météo* :\n\n${res.data}`);
            } catch (e) {
                await reply(`_❌ Impossible de récupérer la météo pour "${q}"._`);
            }
        }
    },
    {
        name: 'qr',
        aliases: ['qrcode'],
        desc: 'Fusionne votre phrase, mot, numéro ou URL secrète dans un beau QRCode prêt à scanner.',
        usage: '.qr <URL ou donnée brute>',
        execute: async (ctx) => {
            const { q, sock, from, msg, reply } = ctx;
            if (!q) return await reply(`_Indiquez un texte ou un lien. Ex: \`.qr Coucou\`_`);
            try {
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(q)}`;
                await sock.sendMessage(from, { image: { url: qrUrl }, caption: `_📱 QRCode généré pour :_ ${q}` }, { quoted: msg });
            } catch (e) { await reply(`_❌ Erreur de génération QRCode._`); }
        }
    },
    {
        name: 'tts',
        desc: 'Donne de la voix text-to-speech vocale ! Il transmet un vocal synthétique.',
        usage: '.tts [langue] <texte libre>',
        execute: async (ctx) => {
            const { q, args, sock, from, msg, reply } = ctx;
            let lang = 'fr';
            let text = q;
            if (args[0]?.length === 2 && args.length > 1) { 
                lang = args[0];
                text = args.slice(1).join(' ');
            }
            if (!text) return await reply(`_Texte manquant. Ex: \`.tts fr Bonjour\`_`);
            try {
                const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${lang}&q=${encodeURIComponent(text)}`;
                await sock.sendMessage(from, { audio: { url: ttsUrl }, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg });
            } catch(e) { await reply(`_❌ Erreur TTS._`); }
        }
    },
    {
        name: 'short',
        aliases: ['shorturl'],
        desc: 'Compresse instantanément une très (trop?) longue URL hypertexte.',
        usage: '.short <lien immensément long>',
        execute: async (ctx) => {
            const { q, reply } = ctx;
            if (!q || !q.startsWith('http')) return await reply(`_Lien invalide. Ex: \`.short https://exemple.com\`_`);
            try {
                const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(q)}`);
                await reply(`_🔗 Lien raccourci :_ ${res.data}`);
            } catch (e) { await reply(`_❌ Impossible de raccourcir ce lien._`); }
        }
    },
    {
        name: 'github',
        desc: 'Recherche la carte développeur Github publique de n\'importe quelle personne et sort ses repos.',
        usage: '.github <pseudo de developpeur>',
        execute: async (ctx) => {
            const { q, sock, from, msg, reply } = ctx;
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
    },
    {
        name: 'jid',
        desc: 'Extirpe violemment la fameuse adresse chiffrée (@s.whatsapp.net / @g.us) indispensable en admin.',
        usage: 'Repondre: .jid',
        execute: async (ctx) => {
            const { from, msg, reply } = ctx;
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
    }
];
