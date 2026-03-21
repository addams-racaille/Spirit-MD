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

module.exports = [
    {
        name: 'inactive',
        desc: 'Détecte les membres fantômes (inactifs), avec possibilité d\'expulsion massive (kick).',
        usage: '.inactive <durée(10d|1m)> [kick]',
        groupOnly: true,
        execute: async (ctx) => {
            const { q, from, sock, reply } = ctx;
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
                        await new Promise(r => setTimeout(r, 1000));
                    } catch(e) {}
                }
                return await reply(`_✅ ${kickCount} inactif(s) expulsé(s)._`);
            } else {
                for (let i = 0; i < inactiveMembers.length; i++) {
                    const m = inactiveMembers[i];
                    responseMsg += `${i+1}. @${m.jid.split('@')[0]} (${m.name})\n`;
                    responseMsg += `   _Vu : ${m.lastMessage} | Msg : ${m.totalMessages}_\n\n`;
                }
                responseMsg += `\n_Pour expulser: .inactive ${durationStr} kick_`;
                await sock.sendMessage(from, { text: responseMsg, mentions: inactiveMembers.map(m => m.jid) });
            }
        }
    },
    {
        name: 'warn',
        desc: 'Donne un avertissement officiel à un membre. (3 avertissements = Bannissement immédiat du groupe)',
        usage: 'A répondre avec: .warn [raison]',
        groupOnly: true,
        adminOnly: true,
        execute: async (ctx) => {
            const { q, from, sock, msg, reply } = ctx;
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
                } catch (e) {}
            } else {
                await reply(`_⚠️ @${targetJid.split('@')[0]} : ${count}/${MAX_WARNS} avertissements._\n${q ? `_Raison : ${q}_` : ''}`, { mentions: [targetJid] });
            }
        }
    },
    {
        name: 'warnings',
        desc: 'Affiche publiquement le nombre d\'avertissements actuels (sur 3) d\'un membre spécifique.',
        usage: '.warnings [@user]',
        groupOnly: true,
        execute: async (ctx) => {
            const { q, from, msg, reply } = ctx;
            const targetJid = msg.message?.extendedTextMessage?.contextInfo?.participant
                           || (q ? `${q.replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
            if (!targetJid) return await reply(`_Réponds ou mentionne quelqu'un._`);
            const count = await db.getWarnings(targetJid, from);
            await reply(`_@${targetJid.split('@')[0]} a ${count}/3 avertissement(s) dans ce groupe._`, { mentions: [targetJid] });
        }
    },
    {
        name: 'resetwarn',
        desc: 'Pardonne un membre fautif et remet son compteur d\'avertissements à zéro (0/3).',
        usage: '.resetwarn [@user]',
        groupOnly: true,
        adminOnly: true,
        execute: async (ctx) => {
            const { from, msg, reply } = ctx;
            const targetJid = msg.message?.extendedTextMessage?.contextInfo?.participant
                           || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!targetJid) return await reply(`_Réponds ou mentionne quelqu'un._`);
            await db.resetWarnings(targetJid, from);
            await reply(`_✅ Avertissements de @${targetJid.split('@')[0]} réinitialisés._`, { mentions: [targetJid] });
        }
    },
    {
        name: 'kick',
        desc: 'Expulse immédiatement un utilisateur du groupe sans avertissement ni sommations.',
        usage: '.kick [@user]',
        groupOnly: true,
        adminOnly: true,
        execute: async (ctx) => {
            const { from, sock, msg, reply } = ctx;
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
    },
    {
        name: 'promote',
        desc: 'Offre le grade d\'Administrateur de Groupe à un simple membre sélectionné.',
        usage: '.promote [@user]',
        groupOnly: true,
        adminOnly: true,
        execute: async (ctx) => {
            const { from, sock, msg, reply } = ctx;
            const target = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) return await reply(`_Réponds ou mentionne l'utilisateur._`);
            try {
                await sock.groupParticipantsUpdate(from, [target], 'promote');
                await reply(`_✅ @${target.split('@')[0]} est maintenant administrateur._`, { mentions: [target] });
            } catch (e) { await reply(`_❌ Erreur, le bot est-il admin ?_`); }
        }
    },
    {
        name: 'demote',
        desc: 'Retire violemment les droits d\'Administrateur à un utilisateur et le rétrograde simple membre.',
        usage: '.demote [@user]',
        groupOnly: true,
        adminOnly: true,
        execute: async (ctx) => {
            const { from, sock, msg, reply } = ctx;
            const target = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) return await reply(`_Réponds ou mentionne l'utilisateur._`);
            try {
                await sock.groupParticipantsUpdate(from, [target], 'demote');
                await reply(`_✅ @${target.split('@')[0]} n'est plus administrateur._`, { mentions: [target] });
            } catch (e) { await reply(`_❌ Erreur, le bot est-il admin ?_`); }
        }
    },
    {
        name: 'group',
        aliases: ['groupe'],
        desc: 'Ouvre ou Ferme le canal de discussion vocal/écrit du groupe aux non-admins.',
        usage: '.group open / .group close',
        groupOnly: true,
        adminOnly: true,
        execute: async (ctx) => {
            const { q, from, sock, reply } = ctx;
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
    },
    {
        name: 'setdesc',
        desc: 'Applique une nouvelle description au profil du groupe actuel en un battement de cil.',
        usage: '.setdesc <description>',
        groupOnly: true,
        adminOnly: true,
        execute: async (ctx) => {
            const { q, from, sock, reply } = ctx;
            if (!q) return await reply(`_Texte manquant._`);
            try {
                await sock.groupUpdateDescription(from, q);
                await reply(`_✅ Description mise à jour avec succès._`);
            } catch (e) { await reply(`_❌ Impossible de modifier la description._`); }
        }
    },
    {
        name: 'link',
        aliases: ['lien'],
        desc: 'Demande et extrait le lien d\'invitation unique (WhatsApp Link) pour intégrer ce groupe.',
        usage: '.link',
        groupOnly: true,
        execute: async (ctx) => {
            const { from, sock, reply } = ctx;
            try {
                const code = await sock.groupInviteCode(from);
                await reply(`_🔗 Lien du groupe :_\nhttps://chat.whatsapp.com/${code}`);
            } catch (e) { await reply(`_❌ Impossible d'obtenir le lien (le bot doit être admin)._`); }
        }
    },
    {
        name: 'hidetag',
        desc: 'Mentionne secrètement TOUT LE GROUPE de manière cachée et invisible dans le message envoyé.',
        usage: '.hidetag <votre grosse annonce>',
        groupOnly: true,
        adminOnly: true,
        execute: async (ctx) => {
            const { q, from, sock } = ctx;
            const groupMeta = await sock.groupMetadata(from);
            const members = groupMeta.participants.map(m => m.id);
            await sock.sendMessage(from, { text: q || '\u200B', mentions: members });
        }
    }
];
