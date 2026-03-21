const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const config = require('./config');

const handleStatus = require('./events/statusReader');
const handleAntiDelete = require('./events/antiDelete');
const handleAntiEdit = require('./events/antiEdit');

const baileysLogger = pino({ level: 'silent' });
const NodeCache = require('node-cache');
const messageCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600, useClones: false });

// ─── VARIABLES GLOBALES ────────────────────────────────────────────────────────
global.activeSessions = new Map(); // Garde en mémoire les instances allumées
global.dbReady = false;

function getBody(msg) {
    const m = msg.message;
    if (!m) return '';
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.buttonsResponseMessage?.selectedButtonId ||
        m.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ''
    );
}

// ─── BOT SaaS ──────────────────────────────────────────────────────────────────
async function startBot(sessionId = 'master', isMaster = false, requestNumber = null) {
    const sessionFolder = path.join(__dirname, 'sessions', sessionId);
    
    if (!fs.existsSync(path.join(__dirname, 'sessions'))) {
        fs.mkdirSync(path.join(__dirname, 'sessions'));
    }

    if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: baileysLogger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        browser: ['Mac OS', 'Safari', '10.15.7'], // Furtivité Anti-Ban
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false, // Furtivité
        shouldSyncHistoryMessage: () => false,
    });

    sock.customSessionId = sessionId;
    sock.isMaster = isMaster;
    sock.customOwner = requestNumber || config.OWNER_NUMBER; // Pour les sub-bots
    sock.isReconnecting = false;
    
    global.activeSessions.set(sessionId, sock);

    // ── Pairing Code ──────────────────────────────────────────────────────────
    if (!sock.authState.creds.registered) {
        if (isMaster) {
            console.log(chalk.yellow(`⚠️ Aucune session MASTER trouvée.`));
            const targetNumber = config.OWNER_NUMBER || '22658606907';
            console.log(chalk.yellow(`Génération du code Maître pour ${targetNumber}...`));
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(targetNumber);
                    const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log(chalk.cyan('\n============================================='));
                    console.log(chalk.white(' 🔗 CODE MASTER : '), chalk.yellow.bold(formatted));
                    console.log(chalk.cyan('=============================================\n'));
                } catch (e) {
                    console.log(chalk.red('Erreur Pairing Code Master:'), e.message);
                }
            }, 3000);
        }
    } else {
        console.log(chalk.green(`✅ Session chargée : ${sessionId} ${isMaster ? '(MAÎTRE)' : '(SOUS-BOT)'}`));
    }

    sock.ev.on('creds.update', saveCreds);

    // ── Connexion ─────────────────────────────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.message || '';
            const isConflict = reason.toLowerCase().includes('conflict') || statusCode === 440;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;

            console.log(chalk.red(`❌ Connexion fermée [${sessionId}]. Raison :`), reason || statusCode);

            if (isLoggedOut) {
                console.log(chalk.red(`⚠️ Déconnecté (Logged Out) [${sessionId}]. On supprime sa session.`));
                if (fs.existsSync(sessionFolder)) fs.rmSync(sessionFolder, { recursive: true, force: true });
                global.activeSessions.delete(sessionId);
            } else if (!sock.isReconnecting) {
                sock.isReconnecting = true;
                const delay = isConflict ? 15000 : 5000;
                setTimeout(() => { 
                    startBot(sessionId, isMaster, sock.customOwner); 
                }, delay);
            }
        } else if (connection === 'open') {
            sock.isReconnecting = false;
            if (isMaster) {
                console.log(chalk.cyan(figlet.textSync('MASTER !', { horizontalLayout: 'full' })));
            }
            console.log(chalk.green(`✅ Bot connecté et prêt : [${sessionId}]`));
            
            if (isMaster) {
                const pendingUpdateJid = await db.getVar('UPDATE_PENDING', '');
                if (pendingUpdateJid) {
                    try {
                        await sock.sendMessage(pendingUpdateJid, { text: `_✅ Redémarrage réussi ! Le bot est à jour et opérationnel._` });
                        await db.setVar('UPDATE_PENDING', ''); 
                    } catch(e) {}
                }
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message) continue;

            const from = msg.key.remoteJid;
            const isFromMe = msg.key.fromMe;
            const pushName = msg.pushName || 'Inconnu';
            
            if (from !== 'status@broadcast') {
                db.logMessage(msg).catch(() => {});
            } else {
                handleStatus(sock, msg).catch(() => {});
                continue;
            }

            if (msg.key.id) {
                messageCache.set(msg.key.id, msg);
            }

            handleAntiDelete(sock, msg, messageCache).catch(() => {});
            handleAntiEdit(sock, msg, messageCache).catch(() => {});

            const body = getBody(msg);

            // Blacklist (Partagé globalement pour tout le serveur)
            if (from.endsWith('@g.us') && body && !isFromMe) {
                const participant = msg.key.participant || from;
                const exceptions = await db.getExceptions();
                
                if (participant !== `${sock.customOwner}@s.whatsapp.net` && !exceptions.includes(participant)) {
                    const blacklisted = await db.getBlacklistWords();
                    const bodyLower = body.toLowerCase();
                    const foundWord = blacklisted.find(w => bodyLower.includes(w));
                    if (foundWord) {
                        try {
                            await sock.sendMessage(from, { delete: msg.key });
                            await sock.sendMessage(from, { text: `_⚠️ @${participant.split('@')[0]}, interdit._`, mentions: [participant] });
                            continue;
                        } catch (e) {}
                    }
                }
            }

            // Commandes
            if (body && body.startsWith(config.PREFIX)) {
                console.log(chalk.blue(`[CMD][${sessionId}] ${pushName}: ${body}`));
                const args = body.slice(config.PREFIX.length).trim().split(/ +/);
                const commandName = args.shift().toLowerCase();
                const q = args.join(' ');
                
                try {
                    require('./commands')(sock, msg, commandName, q, from, messageCache)
                        .catch(e => console.log(chalk.red('[CMD REJET]'), e.message));
                } catch (e) {
                    console.log(chalk.red('[CMD ERR]'), e.message);
                }
            }
        }
    });

    return sock;
}

// ─── Lancement au démarrage ──────────────────────────────────────────────────
(async () => {
    await db.initDB();
    global.dbReady = true;

    // Migrer l'ancien dossier `session` vers `sessions/master` si besoin
    if (fs.existsSync(path.join(__dirname, 'session')) && !fs.existsSync(path.join(__dirname, 'sessions', 'master'))) {
        fs.mkdirSync(path.join(__dirname, 'sessions'), { recursive: true });
        fs.renameSync(path.join(__dirname, 'session'), path.join(__dirname, 'sessions', 'master'));
    }

    const sessionsDir = path.join(__dirname, 'sessions');
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir);
    
    // Lire les dossiers
    const folders = fs.readdirSync(sessionsDir).filter(f => fs.lstatSync(path.join(sessionsDir, f)).isDirectory());
    
    if (folders.length === 0) {
        // Aucune session, on start le master nativement
        await startBot('master', true);
    } else {
        // Lancer chaque dossier détecté
        for (const f of folders) {
            // Le nom d'un sous-bot contient le numéro (ex: user_33612...) on l'extrait si s'en est un
            const isMaster = (f === 'master');
            const ownerMatch = f.match(/^user_(\d+)$/);
            const subOwner = ownerMatch ? ownerMatch[1] : null;
            
            await startBot(f, isMaster, subOwner);
            await new Promise(r => setTimeout(r, 2000)); // Anti-spam boot
        }
    }
})();

module.exports = { startBot };

process.on('SIGINT', () => {
    console.log(chalk.red('\n🚫 Arrêt des bots.'));
    process.exit(0);
});
