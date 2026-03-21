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
        desc: 'Ping le serveur WhatsApp pour calculer la latence de réponse en millisecondes.',
        usage: '.ping',
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
        desc: 'Affiche un panel complet et technique de l\'état de la RAM, du CPU et de l\'hôte VPS.',
        usage: '.system',
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
        desc: 'Exécute directement une ligne de commande Bash/Shell sur le terminal du serveur (Dangereux).',
        usage: '.exec <commande bash>',
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
        desc: 'Force le redémarrage physique complet de la machine virtuelle Linux de l\'hôte.',
        usage: '.rebootvps',
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
        desc: 'Pruge la mémoire cache interne des messages du bot pour libérer massivement de la RAM.',
        usage: '.clearcache',
        masterOnly: true,
        execute: async (ctx) => {
            const oldSize = ctx.messageCache.keys().length;
            ctx.messageCache.flushAll();
            await ctx.reply(`🧹 *Cache vidé*\n✅ **${oldSize}** messages ont été effacés du cache mémoire.`);
        }
    },
    {
        name: 'disk',
        desc: 'Examine en profondeur l\'occupation du disque dur (Root FS) du serveur cible.',
        usage: '.disk',
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
        desc: 'Affiche la liste interactive instantanée PM2 des instances qui tournent en tâche de fond.',
        usage: '.pm2list',
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
        desc: 'Ordonne à PM2 de relancer brutalement toutes les instances Node.js actives.',
        usage: '.pm2restart',
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
        desc: 'Affiche les 20 dernières lignes des logs d\'erreurs de la console PM2 de l\'application.',
        usage: '.pm2logs',
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
        desc: 'Scanne les interfaces réseaux pour extraire l\'IPv4 publique et locale du Serveur.',
        usage: '.network',
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
        desc: 'Lance un speedtest interactif de la bande passante réseau exacte du serveur Linux.',
        usage: '.speedtest',
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
        desc: 'Vérifie, liste ou gère les Pull Git de manière sécurisée pour mettre le bot à jour.',
        usage: '.update [check/apply/list/revert <ID>]',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const args = q.trim().split(/ +/);
            const action = args[0]?.toLowerCase();

            if (!action || action === 'check') {
                await reply(`_⏳ Recherche de mises à jour en cours..._`);
                exec('git fetch origin main && git log HEAD..origin/main --oneline', async (error, stdout) => {
                    const output = stdout ? stdout.trim() : '';
                    if (!output) {
                        return await reply(`*✅ Système à jour*\n_Aucune nouvelle mise à jour n'est disponible._\n\n_Tu peux voir l'historique avec_ \`.update list\``);
                    }
                    const commits = output.split('\n');
                    let msg = `*🔄 MISES À JOUR DISPONIBLES (${commits.length})*\n\n`;
                    commits.slice(0, 10).forEach(c => {
                        msg += `> ${c}\n`;
                    });
                    if (commits.length > 10) msg += `> ...et ${commits.length - 10} autres.\n`;
                    msg += `\n_Pour installer ces mises à jour, tapez :_ \`.update apply\``;
                    await reply(msg);
                });
                return;
            }

            if (action === 'apply' || action === 'now') {
                await reply(`_⏳ Synchronisation pure et dure avec GitHub..._`);
                exec('git fetch origin main && git reset --hard origin/main', async (error, stdout, stderr) => {
                    const output = stdout ? stdout.trim() : (stderr ? stderr.trim() : '');
                    if (error) {
                        return await reply(`*❌ ERREUR LORS DE LA MISE À JOUR*\n\n\`\`\`${output}\`\`\``);
                    }
                    await reply(`*✅ MISE À JOUR TERMINÉE*\n_Le système va redémarrer pour appliquer les changements._`);
                    await db.setVar('UPDATE_PENDING', ctx.from);
                    setTimeout(() => process.exit(0), 1000);
                });
                return;
            }

            if (action === 'list' || action === 'history') {
                await reply(`_⏳ Récupération de l'historique des versions..._`);
                exec('git log -n 15 --oneline', async (error, stdout) => {
                    const output = stdout ? stdout.trim() : '';
                    if (!output || error) {
                        return await reply(`*❌ Impossible de lire l'historique Git.*`);
                    }
                    let msg = `*📜 HISTORIQUE DES VERSIONS (15 max)*\n\n`;
                    output.split('\n').forEach(c => {
                        const id = c.substring(0, 7);
                        const desc = c.substring(8);
                        msg += `> 🆔 \`${id}\` : ${desc}\n`;
                    });
                    msg += `\n_Pour revenir à une ancienne version, tapez :_ \`.update revert <ID>\``;
                    await reply(msg);
                });
                return;
            }

            if (action === 'revert' || action === 'rollback') {
                const target = args[1];
                if (!target) return await reply(`_⚠️ Veuillez fournir un ID de mise à jour. (Ex: \`.update revert a1b2c3d\`)\n\nUtilisez \`.update list\` pour voir les IDs._`);
                
                await reply(`_⏳ Restauration forcée vers la version : ${target}..._`);
                exec(`git reset --hard ${target}`, async (error, stdout, stderr) => {
                    const output = stdout ? stdout.trim() : (stderr ? stderr.trim() : '');
                    if (error) {
                        return await reply(`*❌ CIBLE INTROUVABLE / ERREUR*\n\n\`\`\`${output}\`\`\``);
                    }
                    await reply(`*🔙 RESTAURATION RÉUSSIE*\n\n\`\`\`${output}\`\`\`\n\n_Redémarrage en cours (5s)..._`);
                    await db.setVar('UPDATE_PENDING', ctx.from);
                    setTimeout(() => process.exit(0), 1000);
                });
                return;
            }

            await reply(`_⚠️ Option invalide.\nUtilisation :\n- \`.update check\` (Vérifie les maj)\n- \`.update apply\` (Installe)\n- \`.update list\` (Historique)\n- \`.update revert <ID>\` (Retour en arrière)_`);
        }
    },
    {
        name: 'menu',
        aliases: ['help'],
        desc: 'Affiche la liste complète des commandes ou l\'aide détaillée d\'une commande.',
        usage: '<prefix>help [commande]',
        execute: async (ctx) => {
            const target = ctx.q.toLowerCase().trim();
            const { commands } = require('../handlers/commandHandler');
            const p = ctx.currentPrefix || '.';

            if (target) {
                const cmd = commands.get(target);
                if (!cmd) return await ctx.reply(`_❌ Commande inconnue : ${target}_`);
                let msg = `📘 *AIDE COMMANDE* : \`${p}${cmd.name}\`\n\n`;
                if (cmd.aliases && cmd.aliases.length > 0) msg += `🔗 *Alias* : ${cmd.aliases.map(a=>`${p}${a}`).join(', ')}\n`;
                msg += `📖 *Description* : ${cmd.desc || 'Aucune description fournie.'}\n`;
                msg += `📝 *Utilisation* : ${cmd.usage ? `\`${cmd.usage.replace(/^\./, p)}\`` : `\`${p}${cmd.name}\``}\n`;
                msg += `📂 *Catégorie* : ${cmd.category.toUpperCase()}\n`;
                if (cmd.adminOnly) msg += `⚠️ *Restriction* : Réservé aux administrateurs du bot.\n`;
                if (cmd.masterOnly) msg += `👑 *Restriction* : Réservé au Maître hébergeur.\n`;
                return await ctx.reply(msg);
            }

            const categories = {};
            for (const [name, cmd] of commands.entries()) {
                if (name === cmd.name) { 
                    if (!categories[cmd.category]) categories[cmd.category] = [];
                    categories[cmd.category].push(cmd.name);
                }
            }

            let menuText = `╔══════════════════════════╗\n`;
            menuText += `║        *𝐒𝐏𝐈𝐑𝐈𝐓-𝐌𝐃*         ║\n`;
            menuText += `╚══════════════════════════╝\n\n`;
            menuText += `👑 *Propriétaire:* Ouédraogo Fabrice\n`;
            menuText += `⚙️ *Mode:* ${ctx.currentMode.toUpperCase()}\n`;
            menuText += `🔧 *Préfixe:* \`${p}\`\n\n`;
            menuText += `_Tapez_ \`${p}help <commande>\` _pour avoir les détails d'utilisation !_\n\n`;

            const catMap = {
                admin: '🔥 PARAMÈTRES ADMIN',
                moderation: '🛡️ MODÉRATION GROUPE',
                media: '🎬 TÉLÉCHARGEMENTS & MÉDIAS',
                utils: '⚙️ UTILITAIRES DE BASE',
                social: '🫂 ACTIONS SOCIALES',
                tools: '🧰 OUTILS & DEV',
                fun: '🎉 FUN & DIVERTISSEMENT',
                games: '🎲 MINI-JEUX & ÉCONOMIE',
                info: '📚 INFORMATIONS & RECHERCHES',
                system: '💻 CONTRÔLE SYSTÈME (VPS)',
                saas: '☁️ HÉBERGEMENT SAAS'
            };

            for (const cat in categories) {
                const title = catMap[cat] || `📁 ${cat.toUpperCase()}`;
                
                if ((cat === 'system' || cat === 'saas') && !ctx.isMasterAdmin) continue;

                menuText += `*${title}*\n`;
                menuText += `> ${categories[cat].map(c => `${p}${c}`).join(' • ')}\n\n`;
            }

            await ctx.reply(menuText.trim());
        }
    }
];
