const fs = require('fs');
const path = require('path');

module.exports = [
    {
        name: 'session',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply, sock } = ctx;
            if (!q) return await reply(`_⚠️ Précise un numéro pour générer son espace de sous-bot. Ex: \`.session 33612345678\`_`);
            const subNum = q.replace(/[^0-9]/g, '');
            if (subNum.length < 10) return await reply(`_❌ Numéro invalide._`);
            
            await reply(`_⏳ Démarrage d'une structure serveur isolée pour le ${subNum}..._\n_Veuillez patienter..._`);
            
            try {
                const { startBot } = require('../index');
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
    },
    {
        name: 'listbots',
        masterOnly: true,
        execute: async (ctx) => {
            const sessionsMap = global.activeSessions;
            if (!sessionsMap || sessionsMap.size === 0) return await ctx.reply(`_Aucun bot actuellement en ligne._`);
            
            let txt = `🌐 *LISTE DES INSTANCES SAAS (${sessionsMap.size})*\n\n`;
            for (const [sid, sSock] of sessionsMap.entries()) {
                const isM = sSock.isMaster ? '👑 MASTER' : '🤖 CLIENT';
                txt += `🔹 *ID:* ${sid}\n   *Type:* ${isM}\n   *Propriétaire:* ${sSock.customOwner || 'Aucun'}\n\n`;
            }
            await ctx.reply(txt);
        }
    },
    {
        name: 'delbot',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            if (!q) return await reply(`_Précisez l'ID entier du bot à supprimer. (Ex: \`.delbot user_33612345678\`)_`);
            const targetId = q.trim();
            if (targetId === 'master') return await reply(`_❌ Tu ne peux pas te supprimer toi-même !_`);
            
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
                    await reply(`_✅ Le client **${targetId}** a été déconnecté pour toujours et ses données effacées du VPS._`);
                } catch(e) {
                    await reply(`_❌ Erreur de suppression : ${e.message}_`);
                }
            } else {
                await reply(`_❌ Bot introuvable._`);
            }
        }
    },
    {
        name: 'restartbot',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            if (!q) return await reply(`_Précisez l'ID du bot (ex: user_336... ou master)._`);
            const targetId = q.trim();
            const sessionsMap = global.activeSessions;
            if (sessionsMap && sessionsMap.has(targetId)) {
                try {
                    const sSock = sessionsMap.get(targetId);
                    sSock.end(new Error('Restart Requested')); 
                    await reply(`_✅ Le bot **${targetId}** est en train de redémarrer..._`);
                } catch(e) {
                    await reply(`_❌ Erreur: ${e.message}_`);
                }
            } else {
                await reply(`_❌ Bot introuvable en mémoire._`);
            }
        }
    },
    {
        name: 'logs',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            if (!q) return await reply(`_Précisez l'ID (ex: user_336... ou master)_`);
            const targetId = q.trim();
            try {
                const logPath = path.join(__dirname, '../logs', 'out.log');
                if (!fs.existsSync(logPath)) return await reply(`_Fichier log inexistant._`);
                
                const stats = fs.statSync(logPath);
                const startPos = Math.max(0, stats.size - 15000);
                let buffer = Buffer.alloc(15000);
                const fd = fs.openSync(logPath, 'r');
                const bytesRead = fs.readSync(fd, buffer, 0, 15000, startPos);
                fs.closeSync(fd);
                
                const lines = buffer.toString('utf-8', 0, bytesRead).split('\n');
                const filtered = lines.filter(l => l.includes(`[${targetId}]`));
                const lastLines = filtered.slice(-15).join('\n');
                
                if (!lastLines) return await reply(`_Aucun log trouvé pour ${targetId}._`);
                await reply(`📄 *LOGS - ${targetId}*\n\n\`\`\`\n${lastLines}\n\`\`\``);
            } catch (e) {
                await reply(`_❌ Erreur lecture logs : ${e.message}_`);
            }
        }
    }
];
