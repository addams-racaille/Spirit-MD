const fs = require('fs');
const path = require('path');

module.exports = [
    {
        name: 'session',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply, sock } = ctx;
            if (!q) return await reply(`_⚠️ FORMAT INVALIDE_\n_Utilisation : \`.session 33612345678\`_`);
            const subNum = q.replace(/[^0-9]/g, '');
            if (subNum.length < 10) return await reply(`_❌ Erreur : Ce numéro ne semble pas valide._`);
            
            const startMsg = await reply(`🔌 *GÉNÉRATEUR DE CLÔNE SAAS*\n\n_Création d'un espace VPS indépendant pour le \`${subNum}\`..._\n_Veuillez patienter..._`);
            
            try {
                const { startBot } = require('../index');
                const subSock = await startBot('user_' + subNum, false, subNum);
                
                setTimeout(async () => {
                    try {
                        const code = await subSock.requestPairingCode(subNum);
                        const formatted = code.match(/.{1,4}/g).join('-');
                        
                        let txt = `━━━━━━━━━━━━━━━━━━━━━\n`;
                        txt += `✅ *INSTANCE BOT DÉPLOYÉE AVEC SUCCÈS*\n`;
                        txt += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                        txt += `🔑 *CODE SECRET CLIENT* :  👉  *${formatted}*  👈\n\n`;
                        txt += `_Instructions pour votre client :_\n`;
                        txt += `1. Aller sur son propre WhatsApp.\n`;
                        txt += `2. *Appareils liés* > *Lier un appareil*.\n`;
                        txt += `3. Appuyer sur "Lier avec numéro de téléphone" tout en bas.\n`;
                        txt += `4. Insérer ce code confidentiel.\n\n`;
                        txt += `_Dès la connexion, son bot tournera 24/7 de façon complètement autonome dans sa dimension propre sur ce VPS !_`;
                        
                        await ctx.editMsg(startMsg, txt);
                    } catch (e) {
                         await ctx.editMsg(startMsg, `_❌ HUSTON, ON A UN PROBLÈME : (Veuillez relancer la commande) ${e.message}_`);
                    }
                }, 4500);
            } catch (e) {
                await ctx.editMsg(startMsg, `_❌ Crash fatal de la matrice SaaS : ${e.message}_`);
            }
        }
    },
    {
        name: 'listbots',
        masterOnly: true,
        execute: async (ctx) => {
            const sessionsMap = global.activeSessions;
            if (!sessionsMap || sessionsMap.size === 0) return await ctx.reply(`_Aucune entité connectée au cluster._`);
            
            let txt = `🌐 *RÉSEAU MULTI-VERS (SAAS)* 🌐\n`;
            txt += `_Serveurs Actifs : ${sessionsMap.size}_\n\n`;
            
            let count = 1;
            for (const [sid, sSock] of sessionsMap.entries()) {
                const isM = sSock.isMaster ? '👑 DIEU (Master)' : '🤖 CLIENT';
                txt += `*#${count} | ${isM}*\n`;
                txt += ` ├ 🆔 ID    : \`${sid}\`\n`;
                txt += ` ├ 👤 Owner : \`${sSock.customOwner || 'Inconnu'}\`\n`;
                txt += ` └ 🟢 Statut: CONNECTÉ ET SYNCHRONISÉ\n\n`;
                count++;
            }
            txt += `_> La domniation mondiale est en marche..._`;
            
            await ctx.reply(txt);
        }
    },
    {
        name: 'delbot',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            if (!q) return await reply(`_Précisez l'ID entier du bot à oblitérer. (Ex: \`.delbot user_33612345678\`)_`);
            const targetId = q.trim();
            if (targetId === 'master') return await reply(`_❌ AUTO-DESTRUCTION IMPOSSIBLE. Le maître ne peut se tuer lui-même !_`);
            
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
                    await reply(`☠️ *PURGE COMPLÈTE*\n\n_Le client **${targetId}** a été déconnecté de la matrice._\n_Ses données locales ont été incinérées du VPS._`);
                } catch(e) {
                    await reply(`_❌ Erreur lors de l'oblitération : ${e.message}_`);
                }
            } else {
                await reply(`_❌ Cible Fantôme : Aucun bot avec cet ID._`);
            }
        }
    },
    {
        name: 'restartbot',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            if (!q) return await reply(`_Format: \`.restartbot user_xxx\`_`);
            const targetId = q.trim();
            const sessionsMap = global.activeSessions;
            if (sessionsMap && sessionsMap.has(targetId)) {
                try {
                    const sSock = sessionsMap.get(targetId);
                    sSock.end(new Error('Restart Requested')); 
                    await reply(`_🔄 Séquence de redémarrage initiée pour l'entité **${targetId}**..._`);
                } catch(e) {
                    await reply(`_❌ Erreur systémique: ${e.message}_`);
                }
            } else {
                await reply(`_❌ Cible Fantôme._`);
            }
        }
    },
    {
        name: 'broadcast',
        aliases: ['bc'],
        masterOnly: true,
        execute: async (ctx) => {
            const { q, sock, reply } = ctx;
            if (!q) return await reply(`_Veuillez écrire le message à diffuser à tout le réseau._`);
            
            const sessionsMap = global.activeSessions;
            if (!sessionsMap || sessionsMap.size === 0) return await reply(`_Personne à qui envoyer._`);
            
            let count = 0;
            // Diffuse à *tous* les numéros "owners" des sous-bots qui hébergent chez moi
            for (const [sid, sSock] of sessionsMap.entries()) {
                if (!sSock.isMaster && sSock.customOwner) {
                    const number = `${sSock.customOwner}@s.whatsapp.net`;
                    try {
                        let bcText = `📢 *MESSAGE DU CRÉATEUR DE L'HÉBERGEMENT*\n━━━━━━━━━━━━━━━━━\n\n${q}`;
                        await sock.sendMessage(number, { text: bcText });
                        count++;
                    } catch (e) {}
                }
            }
            await reply(`_✅ Diffusion terminée.\nEnvoyé à ${count} propriétaires de bots SaaS._`);
        }
    }
];
