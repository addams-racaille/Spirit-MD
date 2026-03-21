const os = require('os');
const db = require('../db');
const { exec } = require('child_process');

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(sec) {
    const d = Math.floor(sec / (3600 * 24));
    const h = Math.floor((sec % (3600 * 24)) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${d}j ${h}h ${m}m ${s}s`;
}

function makeBar(percent) {
    const total = 12;
    percent = Math.max(0, Math.min(100, percent));
    const filled = Math.round((percent / 100) * total);
    const empty = total - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

module.exports = [
    {
        name: 'ping',
        execute: async (ctx) => {
            const start = Date.now();
            await ctx.reply('🏓 Calcul de la latence du serveur...');
            const end = Date.now();
            await ctx.reply(`🚀 *VITESSE RÉSEAU INTRA-SERVEURS*\n\n📡 Latence aller-retour : *${end - start} ms*\n_Serveur ultra-réactif._`);
        }
    },
    {
        name: 'system',
        aliases: ['sys', 'vps'],
        execute: async (ctx) => {
            const botUptime = process.uptime();
            const osUptime = os.uptime();
            const ramUsage = process.memoryUsage().rss;
            const totalRam = os.totalmem();
            const freeRam = os.freemem();
            const usedRam = totalRam - freeRam;
            const ramPercent = (usedRam / totalRam) * 100;
            const botRamPercent = (ramUsage / totalRam) * 100;
            
            const cpus = os.cpus();
            const cpuModel = cpus[0].model;
            // Charge CPU (approximation via loadavg sur unix, sinon N/A)
            const load = os.loadavg ? os.loadavg()[0] : 0;
            const cpuPercent = cpus.length ? (load / cpus.length) * 100 : 0;
            
            let txt = `━━━━━━━━━━━━━━━━━━━━━\n`;
            txt += `🔥 *DASHBOARD SYSTÈME ULTIME* 🔥\n`;
            txt += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            txt += `🤖 *PROCESSUS BOT*\n`;
            txt += ` ⏱️ Uptime  : ${formatUptime(botUptime)}\n`;
            txt += ` 🧠 RAM Bot : ${formatBytes(ramUsage)} \n`;
            txt += ` 📊 Poids   : [${makeBar(botRamPercent)}] ${botRamPercent.toFixed(1)}%\n`;
            txt += ` ⚡ Moteur   : Node.js ${process.version}\n\n`;
            
            txt += `🖥️ *MACHINE HÔTE (VPS)*\n`;
            txt += ` 💻 OS      : ${os.type()} ${os.release()} (${os.arch()})\n`;
            txt += ` ⏱️ Allumé  : ${formatUptime(osUptime)}\n`;
            txt += ` 🏷️ CPU     : ${cpuModel.trim()}\n`;
            txt += ` ⚙️ Coeurs  : ${cpus.length} Threads\n`;
            if (process.platform !== 'win32') {
                txt += ` 📈 Charge  : [${makeBar(cpuPercent)}] ${cpuPercent.toFixed(1)}%\n`;
            }
            txt += ` 💾 RAM Tot : ${formatBytes(totalRam)}\n`;
            txt += ` 🟥 RAM Out : [${makeBar(ramPercent)}] ${ramPercent.toFixed(1)}%\n`;
            txt += ` 🟢 RAM In  : ${formatBytes(freeRam)}\n\n`;
            
            txt += `_> "L'excellence par l'optimisation."_`;
            
            await ctx.reply(txt);
        }
    },
    {
        name: 'exec',
        aliases: ['shell', 'cmd', '$'],
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            if (!q) return await reply(`_⚠️ Fournis une ligne de commande (ex: \`.exec ls -la\`)_`);
            exec(q, (error, stdout, stderr) => {
                let txt = `💻 *TERMINAL INTÉGRÉ*\n\n`;
                txt += `❯ \`${q}\`\n\n`;
                if (error) txt += `*❌ ERREUR*\n\`\`\`${error.message}\`\`\`\n\n`;
                if (stderr) txt += `*⚠️ STDERR*\n\`\`\`${stderr}\`\`\`\n\n`;
                if (stdout) txt += `*✅ OUTPUT*\n\`\`\`${stdout}\`\`\``;
                else txt += `_(Aucune sortie générée)_`;
                reply(txt);
            });
        }
    },
    {
        name: 'rebootvps',
        masterOnly: true,
        execute: async (ctx) => {
            await ctx.reply(`🚨 *CRITIQUE* 🚨\n\n_Redémarrage complet de la machine hôte en cours...\nDéconnexion de toutes les instances SaaS imminente._`);
            exec('sudo reboot', (err) => {
                if (err) ctx.reply(`_❌ Échec de la commande (L'hôte tourne peut-être sous Windows ou sans droits sudo)._`);
            });
        }
    },
    {
        name: 'clearcache',
        masterOnly: true,
        execute: async (ctx) => {
            const oldSize = ctx.messageCache.keys().length;
            ctx.messageCache.flushAll();
            await ctx.reply(`🧹 *MAINTENANCE*\n\n_Vampirisation de la RAM stoppée._\n✅ **${oldSize}** messages fantômes ont été effacés du cache principal.`);
        }
    },
    {
        name: 'disk',
        masterOnly: true,
        execute: async (ctx) => {
            exec(process.platform === 'win32' ? 'wmic logicaldisk get size,freespace,caption' : 'df -h /', (error, stdout) => {
                if (error) return ctx.reply(`_❌ Erreur lors de la lecture des disques._`);
                ctx.reply(`💽 *ANALYSE DE STOCKAGE*\n\n\`\`\`\n${stdout.trim()}\n\`\`\``);
            });
        }
    },
    {
        name: 'pm2list',
        masterOnly: true,
        execute: async (ctx) => {
            exec('pm2 jlist', (err, stdout) => {
                if (err) return ctx.reply(`_❌ PM2 introuvable._`);
                try {
                    const list = JSON.parse(stdout);
                    if (list.length === 0) return ctx.reply(`_Aucun processus PM2 en cours._`);
                    let res = `📋 *GÉRANT DE PROCESSUS (PM2)*\n`;
                    res += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                    list.forEach(p => {
                        const statusColor = p.pm2_env.status === 'online' ? '🟢' : '🔴';
                        res += `🤖 *${p.name.toUpperCase()}* [ID: ${p.pm_id}]\n`;
                        res += `   État   : ${statusColor} ${p.pm2_env.status.toUpperCase()}\n`;
                        res += `   CPU    : [${makeBar(p.monit.cpu)}] ${p.monit.cpu}%\n`;
                        res += `   RAM    : ${formatBytes(p.monit.memory)}\n`;
                        res += `   Uptime : ${formatUptime((Date.now() - p.pm2_env.pm_uptime)/1000)}\n`;
                        res += `   Restarts: ${p.pm2_env.restart_time} fois\n\n`;
                    });
                    ctx.reply(res);
                } catch (e) {
                    ctx.reply(`_❌ Erreur lecture Json PM2._`);
                }
            });
        }
    },
    {
        name: 'pm2restart',
        masterOnly: true,
        execute: async (ctx) => {
            await ctx.reply(`_🔄 Rechargement forcé de l'ensemble de la grappe PM2..._`);
            exec('pm2 restart all', (err) => {
                if (err) ctx.reply(`_❌ Échec_`);
            });
        }
    },
    {
        name: 'pm2logs',
        masterOnly: true,
        execute: async (ctx) => {
            exec('pm2 logs --lines 20 --nostream', (err, stdout) => {
                if (err) return ctx.reply(`_❌ Échec de la lecture des logs PM2._`);
                ctx.reply(`📄 *CENTRE DE LOGS PM2*\n\`\`\`\n${stdout.trim()}\n\`\`\``);
            });
        }
    },
    {
        name: 'network',
        masterOnly: true,
        execute: async (ctx) => {
            const nets = os.networkInterfaces();
            let res = `🌐 *INTERFACES RÉSEAU PHYSIQUES*\n\n`;
            for (const name of Object.keys(nets)) {
                res += `📡 *${name}*\n`;
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        res += `   > IPv4 : \`${net.address}\`\n`;
                        res += `   > MAC  : \`${net.mac}\`\n`;
                    }
                }
                res += '\n';
            }
            await ctx.reply(res.trim());
        }
    },
    {
        name: 'speedtest',
        masterOnly: true,
        execute: async (ctx) => {
            const startMsg = await ctx.reply(`_🚀 Ignition des serveurs de test de bande passante... Cela peut prendre jusqu'à 30 secondes._`);
            exec('npx fast-cli -u', async (err, stdout) => {
                if (err) return await ctx.editMsg(startMsg, `_❌ Surcharge réseau : test impossible._`);
                await ctx.editMsg(startMsg, `🌩️ *PERFORMANCES RÉSEAU BRUTES*\n\n\`\`\`\n${stdout.trim()}\n\`\`\`\n\n_Le VPS crache le feu !_`);
            });
        }
    },
    {
        name: 'update',
        masterOnly: true,
        execute: async (ctx) => {
            await ctx.reply(`_⏳ Synchronisation forcée avec le dépôt GitHub..._`);
            exec('git fetch origin main && git reset --hard origin/main', async (error, stdout, stderr) => {
                const output = stdout.trim() || stderr.trim();
                if (error) {
                    return await ctx.reply(`*❌ ERREUR LORS DE LA SYNCHRONISATION*\n\n\`\`\`${output}\`\`\``);
                }
                await ctx.reply(`*🚀 LA MATRICE A ÉTÉ SYNCHRONISÉE !*\n\n\`\`\`${output}\`\`\`\n\n*⚡ Redémarrage en cours (5 secondes)...*`);
                await db.setVar('UPDATE_PENDING', ctx.from);
                setTimeout(() => process.exit(0), 1000);
            });
        }
    },
    {
        name: 'menu',
        aliases: ['help'],
        execute: async (ctx) => {
            const target = ctx.q.toLowerCase().trim();
            if (target) {
                return await ctx.reply(`_Pas d'aide détaillée : Tu es l'élite, tu devines. (Ou tape sans argument)_`);
            }

            let menuText = `╔══════════════════════════╗\n`;
            menuText += `║      💫 *𝐒𝐏𝐈𝐑𝐈𝐓-𝐌𝐃* 💫      ║\n`;
            menuText += `╚══════════════════════════╝\n\n`;
            menuText += `👑 *Maître Suprême:* Ouédraogo Fabrice\n`;
            menuText += `⚙️ *Statut Global:* ${ctx.currentMode.toUpperCase()}\n\n`;

            menuText += `🔥 *𝗣𝗔𝗡𝗡𝗘𝗔𝗨 𝗗𝗘 𝗖𝗢𝗡𝗧𝗥𝗢𝗟𝗘*\n`;
            menuText += `  .mode • .antilink • .blacklist\n`;
            menuText += `  .antidelete • .antiedit\n`;
            menuText += `  .config • .eval • .setname\n\n`;

            menuText += `🛡️ *𝗠𝗢𝗗𝗘𝗥𝗔𝗧𝗜𝗢𝗡 𝗔𝗕𝗦𝗢𝗟𝗨𝗘*\n`;
            menuText += `  .kick • .warn • .warnings • .resetwarn\n`;
            menuText += `  .promote • .demote • .group • .hidetag\n\n`;

            menuText += `🎬 *𝗠𝗘𝗗𝗜𝗔 𝗨𝗡𝗜𝗩𝗘𝗥𝗦𝗘𝗟*\n`;
            menuText += `  .video (mp4/tiktok/ig) • .play (mp3)\n`;
            menuText += `  .sticker • .crop • .tts • .vv\n\n`;

            menuText += `🛠️ *𝗨𝗧𝗜𝗟𝗜𝗧𝗔𝗜𝗥𝗘𝗦*\n`;
            menuText += `  .wiki • .weather • .calc • .translate\n`;
            menuText += `  .remind • .jid • .qr • .short • .github\n\n`;

            menuText += `🎉 *𝗟𝗢𝗜𝗦𝗜𝗥𝗦 𝗘𝗧 𝗝𝗘𝗨𝗫*\n`;
            menuText += `  .8ball • .cat • .dog • .fact • .meme\n`;
            menuText += `  .truth • .dare • .flipcoin • .rps\n`;
            menuText += `  .anime • .crypto • .riddle • .math\n`;
            menuText += `  .compliment • .insult • .motivation\n\n`;

            if (ctx.isMasterAdmin) {
                menuText += `💎 *𝗠𝗔𝗦𝗧𝗘𝗥 𝗦𝗔𝗔𝗦 & 𝗩𝗣𝗦 𝗛𝗢𝗦𝗧*\n`;
                menuText += `  .session • .listbots • .delbot • .restartbot\n`;
                menuText += `  .broadcast • .system • .exec • .rebootvps\n`;
                menuText += `  .clearcache • .disk • .network • .pm2list\n`;
                menuText += `  .pm2logs • .speedtest • .update\n\n`;
            }

            menuText += `_> Tapez le nom de la commande directement._`;

            await ctx.reply(menuText);
        }
    }
];
