const os = require('os');
const db = require('../db');
const { exec } = require('child_process');
const chalk = require('chalk');

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
    return `${d}j ${h}h ${m}m`;
}

module.exports = [
    {
        name: 'ping',
        execute: async (ctx) => {
            const start = Date.now();
            await ctx.reply('🏓 Pong ! Calcul du ping...');
            const end = Date.now();
            await ctx.reply(`🏓 *Pong !*\nLatence : ${end - start}ms`);
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
            const cpus = os.cpus();
            const cpuModel = cpus[0].model;
            const cpuSpeed = cpus[0].speed;
            
            let txt = `⚙️ *INFORMATIONS SYSTÈME AVANCÉES*\n\n`;
            txt += `🤖 *Bot:*\n`;
            txt += ` ├ ⏱️ Uptime  : ${formatUptime(botUptime)}\n`;
            txt += ` ├ 🧠 RAM Bot : ${formatBytes(ramUsage)}\n`;
            txt += ` └ ⚡ Node.js : ${process.version}\n\n`;
            txt += `🖥️ *Serveur (VPS):*\n`;
            txt += ` ├ 💻 OS      : ${os.type()} ${os.release()} (${os.arch()})\n`;
            txt += ` ├ ⏱️ Uptime  : ${formatUptime(osUptime)}\n`;
            txt += ` ├ 💿 CPU     : ${cpus.length} Cores | ${cpuSpeed} MHz\n`;
            txt += ` ├ 🏷️ Modèle  : ${cpuModel.trim()}\n`;
            txt += ` ├ 💾 RAM Tot : ${formatBytes(totalRam)}\n`;
            txt += ` └ 🟢 RAM Lib : ${formatBytes(freeRam)}\n`;
            
            await ctx.reply(txt);
        }
    },
    {
        name: 'exec',
        aliases: ['shell', 'cmd'],
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            if (!q) return await reply(`_⚠️ Aucune commande fournie._`);
            exec(q, (error, stdout, stderr) => {
                if (error) return reply(`*❌ ERREUR*\n\`\`\`${error.message}\`\`\``);
                if (stderr) return reply(`*⚠️ STDERR*\n\`\`\`${stderr}\`\`\``);
                reply(`*✅ OUTPUT*\n\`\`\`${stdout}\`\`\``);
            });
        }
    },
    {
        name: 'rebootvps',
        masterOnly: true,
        execute: async (ctx) => {
            await ctx.reply(`_⚠️ Redémarrage complet du VPS en cours... Le bot sera injoignable pendant quelques minutes._`);
            exec('sudo reboot', (err) => {
                if (err) ctx.reply(`_❌ Impossible de redémarrer le VPS (Droits sudo requis)._`);
            });
        }
    },
    {
        name: 'clearcache',
        masterOnly: true,
        execute: async (ctx) => {
            ctx.messageCache.flushAll();
            await ctx.reply(`_✅ Le cache des messages (NodeCache) a été vidé avec succès._`);
        }
    },
    {
        name: 'disk',
        masterOnly: true,
        execute: async (ctx) => {
            const { os } = process.platform === 'win32' ? 'systeminfo' : 'df -h /';
            exec(process.platform === 'win32' ? 'wmic logicaldisk get size,freespace,caption' : 'df -h /', (error, stdout) => {
                if (error) return ctx.reply(`_❌ Erreur lors de la lecture des disques._`);
                ctx.reply(`💽 *ÉTAT DU DISQUE*\n\`\`\`\n${stdout.trim()}\n\`\`\``);
            });
        }
    },
    {
        name: 'pm2list',
        masterOnly: true,
        execute: async (ctx) => {
            exec('pm2 jlist', (err, stdout) => {
                if (err) return ctx.reply(`_❌ PM2 non installé ou erreur._`);
                try {
                    const list = JSON.parse(stdout);
                    if (list.length === 0) return ctx.reply(`_Aucun processus PM2 en cours._`);
                    let res = `📋 *PROCESSUS PM2*\n\n`;
                    list.forEach(p => {
                        res += `*${p.name}* (ID: ${p.pm_id})\n`;
                        res += ` ├ Statut : ${p.pm2_env.status === 'online' ? '🟢' : '🔴'} ${p.pm2_env.status}\n`;
                        res += ` ├ CPU    : ${p.monit.cpu} %\n`;
                        res += ` └ RAM    : ${formatBytes(p.monit.memory)}\n\n`;
                    });
                    ctx.reply(res);
                } catch (e) {
                    ctx.reply(`_❌ Erreur de parsing PM2._`);
                }
            });
        }
    },
    {
        name: 'pm2restart',
        masterOnly: true,
        execute: async (ctx) => {
            await ctx.reply(`_🔄 Redémarrage du processus courant via PM2..._`);
            exec('pm2 restart all', (err) => {
                if (err) ctx.reply(`_❌ Échec de pm2 restart_`);
            });
        }
    },
    {
        name: 'pm2logs',
        masterOnly: true,
        execute: async (ctx) => {
            exec('pm2 logs --lines 15 --nostream', (err, stdout) => {
                if (err) return ctx.reply(`_❌ Échec de la lecture des logs PM2._`);
                ctx.reply(`📄 *LOGS PM2 (15 dernières lignes)*\n\`\`\`\n${stdout.trim()}\n\`\`\``);
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
                res += `*${name}*\n`;
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        res += ` ├ IPv4 : ${net.address}\n`;
                    }
                }
            }
            await ctx.reply(res);
        }
    },
    {
        name: 'speedtest',
        masterOnly: true,
        execute: async (ctx) => {
            await ctx.reply(`_🚀 Lancement du speedtest sur le VPS... Patientez (~30s)._`);
            exec('npx fast-cli -u', (err, stdout) => {
                if (err) return ctx.reply(`_❌ Erreur du speedtest._`);
                ctx.reply(`🚀 *RÉSULTATS SPEEDTEST*\n\`\`\`\n${stdout.trim()}\n\`\`\``);
            });
        }
    },
    {
        name: 'update',
        masterOnly: true,
        execute: async (ctx) => {
            await ctx.reply(`_⏳ Vérification des mises à jour sur GitHub..._`);
            exec('git pull origin main', async (error, stdout, stderr) => {
                const output = stdout.trim() || stderr.trim();
                if (error && !output.includes('Already up to date')) {
                    return await ctx.reply(`_❌ Échec de la mise à jour._\n\n\`\`\`${output}\`\`\``);
                }
                if (output.includes('Already up to date')) {
                    return await ctx.reply(`_✅ Le bot est déjà sur la version la plus récente._`);
                }
                await ctx.reply(`_🚀 Mise à jour téléchargée avec succès._\n\n\`\`\`${output}\`\`\`\n\n_Redémarrage en cours (Patientez 5 secondes)..._`);
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
                return await ctx.reply(`_Aide individuelle non détaillée ici. Consulte le menu global._`);
            }

            let menuText = `┌─── 「  *𝐒𝐏𝐈𝐑𝐈𝐓-𝐌𝐃*  」 ───\n`;
            menuText += `│ 👤 *Propriétaire:* Ouédraogo Fabrice\n`;
            menuText += `│ ⚙️ *Mode:* ${ctx.currentMode}\n`;
            menuText += `└─────────────────────\n\n`;

            menuText += `✦ 𝗠𝗢𝗗𝗘𝗥𝗔𝗧𝗜𝗢𝗡\n`;
            menuText += `  .kick • .warn • .warnings • .resetwarn\n`;
            menuText += `  .promote • .demote • .group\n\n`;

            menuText += `✦ 𝗖𝗢𝗡𝗙𝗜𝗚 A𝗗𝗠𝗜𝗡\n`;
            menuText += `  .mode • .antilink • .blacklist\n`;
            menuText += `  .antidelete • .antiedit\n\n`;

            menuText += `✦ 𝗠𝗘𝗗𝗜𝗔𝗦\n`;
            menuText += `  .sticker • .play • .tts • .vv\n\n`;

            menuText += `✦ 𝗨𝗧𝗜𝗟𝗦\n`;
            menuText += `  .wiki • .weather • .calc • .translate\n`;
            menuText += `  .remind • .jid • .hidetag\n\n`;

            menuText += `✦ 𝗙𝗨𝗡 & 𝗣𝗨𝗕𝗟𝗜𝗖\n`;
            menuText += `  .joke • .dice • .love • .quote\n`;
            menuText += `  .8ball • .cat • .dog • .fact\n`;
            menuText += `  .truth • .dare • .flipcoin • .rps\n`;
            menuText += `  .anime • .movie • .crypto • .meme\n`;
            menuText += `  .riddle • .compliment • .insult • .math\n\n`;

            if (ctx.isMasterAdmin) {
                menuText += `✦ 𝗦𝗨𝗣𝗘𝗥𝗔𝗗𝗠𝗜𝗡 𝗦𝗔𝗔𝗦 & 𝗩𝗣𝗦\n`;
                menuText += `  .session • .listbots • .delbot • .restartbot\n`;
                menuText += `  .system • .exec • .rebootvps\n`;
                menuText += `  .clearcache • .disk • .pm2list\n`;
                menuText += `  .pm2restart • .pm2logs • .network • .speedtest\n\n`;
            }

            menuText += `_💡 Plus d'infos : tapez directement la commande !_`;

            await ctx.reply(menuText);
        }
    }
];
