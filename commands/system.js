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
            await ctx.reply('🏓 Calcul de la latence...');
            const end = Date.now();
            await ctx.reply(`🚀 *VITESSE RÉSEAU*\n\nLatence : *${end - start} ms*`);
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
            txt += `💻 *DASHBOARD SYSTÈME*\n`;
            txt += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            txt += `🤖 *PROCESSUS BOT*\n`;
            txt += ` ⏱️ Uptime  : ${formatUptime(botUptime)}\n`;
            txt += ` 🧠 RAM Bot : ${formatBytes(ramUsage)} \n`;
            txt += ` 📊 Poids   : [${makeBar(botRamPercent)}] ${botRamPercent.toFixed(1)}%\n`;
            txt += ` ⚡ Node.js : ${process.version}\n\n`;
            
            txt += `🖥️ *SERVEUR HÔTE (VPS)*\n`;
            txt += ` 💻 OS      : ${os.type()} ${os.release()} (${os.arch()})\n`;
            txt += ` ⏱️ Allumé  : ${formatUptime(osUptime)}\n`;
            txt += ` 🏷️ CPU     : ${cpuModel.trim()}\n`;
            txt += ` ⚙️ Coeurs  : ${cpus.length} Threads\n`;
            if (process.platform !== 'win32') {
                txt += ` 📈 Charge  : [${makeBar(cpuPercent)}] ${cpuPercent.toFixed(1)}%\n`;
            }
            txt += ` 💾 RAM Tot : ${formatBytes(totalRam)}\n`;
            txt += ` 🟥 RAM Usée: [${makeBar(ramPercent)}] ${ramPercent.toFixed(1)}%\n`;
            txt += ` 🟢 RAM Lib : ${formatBytes(freeRam)}\n`;
            
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
                let txt = `*TERMINAL*\n\n`;
                txt += `❯ \`${q}\`\n\n`;
                if (error) txt += `*❌ Erreur*\n\`\`\`${error.message}\`\`\`\n\n`;
                if (stderr) txt += `*⚠️ Avertissement*\n\`\`\`${stderr}\`\`\`\n\n`;
                if (stdout) txt += `*✅ Résultat*\n\`\`\`${stdout}\`\`\``;
                else txt += `_(Aucun résultat généré)_`;
                reply(txt);
            });
        }
    },
    {
        name: 'rebootvps',
        masterOnly: true,
        execute: async (ctx) => {
            await ctx.reply(`_Redémarrage du serveur en cours. Toutes les instances seront temporairement déconnectées._`);
            exec('sudo reboot', (err) => {
                if (err) ctx.reply(`_❌ Échec (droits sudo manquants ou système incompatible)._`);
            });
        }
    },
    {
        name: 'clearcache',
        masterOnly: true,
        execute: async (ctx) => {
            const oldSize = ctx.messageCache.keys().length;
            ctx.messageCache.flushAll();
            await ctx.reply(`🧹 *Cache vidé*\n✅ **${oldSize}** messages ont été effacés du cache mémoire.`);
        }
    },
    {
        name: 'disk',
        masterOnly: true,
        execute: async (ctx) => {
            exec(process.platform === 'win32' ? 'wmic logicaldisk get size,freespace,caption' : 'df -h /', (error, stdout) => {
                if (error) return ctx.reply(`_❌ Erreur de lecture des disques._`);
                ctx.reply(`💽 *STOCKAGE*\n\n\`\`\`\n${stdout.trim()}\n\`\`\``);
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
                    let res = `📋 *PROCESSUS (PM2)*\n`;
                    res += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                    list.forEach(p => {
                        const statusColor = p.pm2_env.status === 'online' ? '🟢' : '🔴';
                        res += `🤖 *${p.name.toUpperCase()}* [ID: ${p.pm_id}]\n`;
                        res += `   État   : ${statusColor} ${p.pm2_env.status}\n`;
                        res += `   CPU    : [${makeBar(p.monit.cpu)}] ${p.monit.cpu}%\n`;
                        res += `   RAM    : ${formatBytes(p.monit.memory)}\n`;
                        res += `   Uptime : ${formatUptime((Date.now() - p.pm2_env.pm_uptime)/1000)}\n`;
                        res += `   Restarts: ${p.pm2_env.restart_time}\n\n`;
                    });
                    ctx.reply(res);
                } catch (e) {
                    ctx.reply(`_❌ Erreur de format des données._`);
                }
            });
        }
    },
    {
        name: 'pm2restart',
        masterOnly: true,
        execute: async (ctx) => {
            await ctx.reply(`_🔄 Redémarrage des processus PM2..._`);
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
                if (err) return ctx.reply(`_❌ Échec de la lecture des logs._`);
                ctx.reply(`📄 *LOGS PM2*\n\`\`\`\n${stdout.trim()}\n\`\`\``);
            });
        }
    },
    {
        name: 'network',
        masterOnly: true,
        execute: async (ctx) => {
            const nets = os.networkInterfaces();
            let res = `🌐 *INTERFACES RÉSEAU*\n\n`;
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
            const startMsg = await ctx.reply(`_Test de bande passante en cours (patientez environ 30s)..._`);
            exec('npx fast-cli -u', async (err, stdout) => {
                if (err) return await ctx.editMsg(startMsg, `_❌ Surcharge réseau : test impossible._`);
                await ctx.editMsg(startMsg, `📊 *PERFORMANCES RÉSEAU*\n\n\`\`\`\n${stdout.trim()}\n\`\`\``);
            });
        }
    },
    {
        name: 'update',
        masterOnly: true,
        execute: async (ctx) => {
            await ctx.reply(`_⏳ Synchronisation avec le dépôt GitHub..._`);
            exec('git fetch origin main && git reset --hard origin/main', async (error, stdout, stderr) => {
                const output = stdout.trim() || stderr.trim();
                if (error) {
                    return await ctx.reply(`*❌ ERREUR LORS DU TÉLÉCHARGEMENT*\n\n\`\`\`${output}\`\`\``);
                }
                await ctx.reply(`*✅ MISE À JOUR TERMINÉE*\n\n\`\`\`${output}\`\`\`\n\n*Redémarrage en cours (5s)...*`);
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
                return await ctx.reply(`_(Astuce : Les commandes s'utilisent sans aide détaillée dans ce menu)_`);
            }

            let menuText = `╔══════════════════════════╗\n`;
            menuText += `║        *𝐒𝐏𝐈𝐑𝐈𝐓-𝐌𝐃*         ║\n`;
            menuText += `╚══════════════════════════╝\n\n`;
            menuText += `👑 *Propriétaire:* Ouédraogo Fabrice\n`;
            menuText += `⚙️ *Mode:* ${ctx.currentMode.toUpperCase()}\n\n`;

            menuText += `🔥 *PARAMÈTRES ADMIN*\n`;
            menuText += `  .mode • .antilink • .blacklist\n`;
            menuText += `  .antidelete • .antiedit\n`;
            menuText += `  .config • .eval • .setname\n\n`;

            menuText += `🛡️ *MODÉRATION*\n`;
            menuText += `  .kick • .warn • .warnings • .resetwarn\n`;
            menuText += `  .promote • .demote • .group • .hidetag\n\n`;

            menuText += `🎬 *MÉDIAS*\n`;
            menuText += `  .video (mp4/tiktok/ig) • .play (mp3)\n`;
            menuText += `  .sticker • .crop • .tts • .vv\n\n`;

            menuText += `🛠️ *UTILITAIRES*\n`;
            menuText += `  .wiki • .weather • .calc • .translate\n`;
            menuText += `  .remind • .jid • .qr • .short • .github\n\n`;

            menuText += `🎉 *DIVERS & JEUX*\n`;
            menuText += `  .8ball • .cat • .dog • .fact • .meme\n`;
            menuText += `  .truth • .dare • .flipcoin • .rps\n`;
            menuText += `  .anime • .crypto • .riddle • .math\n`;
            menuText += `  .compliment • .insult • .motivation\n\n`;
            
            menuText += `☁️ *HÉBERGEMENT BOT SAAS*\n`;
            menuText += `  .session (Public, crée votre bot auto)\n\n`;

            if (ctx.isMasterAdmin) {
                menuText += `💎 *PANNEAU MASTER VPS*\n`;
                menuText += `  .listbots • .delbot • .restartbot\n`;
                menuText += `  .broadcast • .system • .exec • .rebootvps\n`;
                menuText += `  .clearcache • .disk • .network • .pm2list\n`;
                menuText += `  .pm2logs • .speedtest • .update\n\n`;
            }

            menuText += `_Tapez le nom de la commande directement._`;

            await ctx.reply(menuText);
        }
    }
];
