const fs = require('fs');
const path = require('path');

module.exports = [
    {
        name: 'session',
        desc: 'Crée instantanément une session autonome connectée à ce numéro de compte.',
        usage: '.session',
        // Commande ouverte à tous pour créer son propre bot !
        execute: async (ctx) => {
            const { reply, sock, msg, from } = ctx;
            const senderJid = msg.key.participant || from;
            const subNum = senderJid.split('@')[0];
            
            const startMsg = await reply(`⏳ *Création de votre instance Bot...*\nNuméro ciblé : \`${subNum}\`\nVeuillez patienter quelques instants...`);
            
            try {
                const { startBot } = require('../index');
                const subSock = await startBot('user_' + subNum, false, subNum);
                
                setTimeout(async () => {
                    try {
                        const code = await subSock.requestPairingCode(subNum);
                        const formatted = code.match(/.{1,4}/g).join('-');
                        
                        let txt = `✅ *INSTANCE SAAS DÉPLOYÉE*\n\n`;
                        txt += `🔑 *CODE DE LIAISON* :  👉  *${formatted}*  👈\n\n`;
                        txt += `_Instructions :_\n`;
                        txt += `1. Allez sur votre WhatsApp.\n`;
                        txt += `2. Allez dans *Appareils liés* > *Lier un appareil*.\n`;
                        txt += `3. Appuyez sur "Lier avec numéro de téléphone" en bas.\n`;
                        txt += `4. Insérez ce code.\n\n`;
                        txt += `_Une fois la connexion établie, votre bot sera autonome et fonctionnel H24._`;
                        
                        await ctx.editMsg(startMsg, txt);
                    } catch (e) {
                         await ctx.editMsg(startMsg, `_❌ Impossible de générer le code pour l'instant. Veuillez réessayer plus tard._`);
                    }
                }, 4500);
            } catch (e) {
                await ctx.editMsg(startMsg, `_❌ Erreur système lors de la création de la session : ${e.message}_`);
            }
        }
    },
    {
        name: 'listbots',
        desc: 'Affiche la liste technique et le statut de toutes les instances bots qui tournent en ce moment sur votre VPS.',
        usage: '.listbots',
        masterOnly: true,
        execute: async (ctx) => {
            const sessionsMap = global.activeSessions;
            if (!sessionsMap || sessionsMap.size === 0) return await ctx.reply(`_Aucune entité connectée au cluster._`);
            
            let txt = `🌐 *RÉSEAU MULTI-BOTS (SAAS)* 🌐\n`;
            txt += `_Sessions Actives : ${sessionsMap.size}_\n\n`;
            
            let count = 1;
            for (const [sid, sSock] of sessionsMap.entries()) {
                const isM = sSock.isMaster ? 'Serveur Principal' : 'Client SaaS';
                txt += `*#${count} | ${isM}*\n`;
                txt += ` ├ 🆔 ID    : \`${sid}\`\n`;
                txt += ` ├ 👤 Owner : \`${sSock.customOwner || 'Aucun'}\`\n`;
                txt += ` └ 🟢 Statut: En ligne\n\n`;
                count++;
            }
            
            await ctx.reply(txt);
        }
    },
    {
        name: 'delbot',
        desc: 'Éteint définitivement et supprime les fichiers corrompus d\'une session distante.',
        usage: '.delbot <ID>',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const p = ctx.currentPrefix || '.';
            if (!q) return await reply(`_Précisez l'ID du bot à supprimer. (Ex: \`${p}delbot user_33612345678\`)_`);
            const targetId = q.trim();
            if (targetId === 'master') return await reply(`_❌ Vous ne pouvez pas supprimer le bot principal._`);
            
            const sessionsMap = global.activeSessions;
            if (sessionsMap && sessionsMap.has(targetId)) {
                try {
                    const sSock = sessionsMap.get(targetId);
                    await sSock.logout(); 
                    sessionsMap.delete(targetId);
                    const sessionFolder = path.join(__dirname, '../sessions', targetId);
                    if (fs.existsSync(sessionFolder)) {
                        fs.rmSync(sessionFolder, { recursive: true, force: true });
                    }
                    await reply(`🗑️ *BOT SUPPRIMÉ*\n\n_Le bot **${targetId}** a été déconnecté et ses données locales supprimées._`);
                } catch(e) {
                    await reply(`_❌ Erreur lors de la suppression : ${e.message}_`);
                }
            } else {
                await reply(`_❌ Aucun bot trouvé avec cet ID._`);
            }
        }
    },
    {
        name: 'restartbot',
        desc: 'Alerte et force le redémarrage à distance d\'une session spécifique buggée.',
        usage: '.restartbot <ID>',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const p = ctx.currentPrefix || '.';
            if (!q) return await reply(`_Format: \`${p}restartbot user_xxx\`_`);
            const targetId = q.trim();
            const sessionsMap = global.activeSessions;
            if (sessionsMap && sessionsMap.has(targetId)) {
                try {
                    const sSock = sessionsMap.get(targetId);
                    sSock.end(new Error('Restart Requested')); 
                    await reply(`_🔄 Séquence de redémarrage pour **${targetId}** initiée..._`);
                } catch(e) {
                    await reply(`_❌ Erreur: ${e.message}_`);
                }
            } else {
                await reply(`_❌ Aucun bot trouvé avec cet ID._`);
            }
        }
    },
    {
        name: 'broadcast',
        aliases: ['bc'],
        desc: 'Envoie un message Global officiel de l\'hébergeur à TOUS les propriétaires de vos sous-bots actuels.',
        usage: '.bc <texte>',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, sock, reply } = ctx;
            const p = ctx.currentPrefix || '.';
            if (!q) return await reply(`_Veuillez écrire le message à diffuser (ex: \`${p}bc Bonjour à tous\`)_`);
            
            const sessionsMap = global.activeSessions;
            if (!sessionsMap || sessionsMap.size === 0) return await reply(`_Personne à qui envoyer._`);
            
            let count = 0;
            for (const [sid, sSock] of sessionsMap.entries()) {
                if (!sSock.isMaster && sSock.customOwner) {
                    const number = `${sSock.customOwner}@s.whatsapp.net`;
                    try {
                        let bcText = `📢 *MESSAGE DE L'HÉBERGEUR DU BOT*\n━━━━━━━━━━━━━━━━━\n\n${q}`;
                        await sock.sendMessage(number, { text: bcText });
                        count++;
                    } catch (e) {}
                }
            }
            await reply(`_✅ Diffusion terminée.\nEnvoyé à ${count} propriétaires de bots._`);
        }
    }
];
