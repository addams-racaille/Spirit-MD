// ─── Suppression du spam de logs Baileys ────────────────────────────────────
const _origLog = console.log;
console.log = (...args) => {
    const msg = args[0];
    if (typeof msg === 'string' && (
        msg.includes('Closing session') ||
        msg.includes('SessionEntry') ||
        msg.includes('Failed to decrypt') ||
        msg.includes('Message failed to decrypt')
    )) return;
    if (typeof msg === 'object' && msg && typeof msg.toString === 'function' && msg.toString().startsWith('SessionEntry')) return;
    _origLog(...args);
};

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const config = require('./config');

const commandHandler = require('./handlers/commandHandler');
const messageHandler = require('./events/messageHandler');

const baileysLogger = pino({ level: 'silent' });
const NodeCache = require('node-cache');

// Cache messages : TTL 15 min, pas de clone pour la RAM
const messageCache = new NodeCache({ stdTTL: 900, checkperiod: 120, useClones: false });

// ─── VARIABLES GLOBALES ────────────────────────────────────────────────────────
global.activeSessions = new Map();
global.dbReady = false;

// Suivi des reconnexions par sessionId (évite le flag sur l'ancien sock)
const reconnectingSet = new Set();

// ─── BOT SaaS ──────────────────────────────────────────────────────────────────
async function startBot(sessionId = 'master', isMaster = false, requestNumber = null) {
    const sessionsDir = path.join(__dirname, 'sessions');
    const sessionFolder = path.join(sessionsDir, sessionId);

    // Création atomique sans race condition
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
    if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

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
        browser: ['Mac OS', 'Safari', '10.15.7'],
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false,
        getMessage: async (key) => {
            // Fournit les messages depuis le cache local pour les retry
            if (key.id) {
                const cached = messageCache.get(key.id);
                if (cached) return cached.message;
            }
            return { conversation: '' };
        },
    });

    sock.customSessionId = sessionId;
    sock.isMaster = isMaster;
    sock.customOwner = requestNumber || config.OWNER_NUMBER;

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
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;
            const isConflict = reason.toLowerCase().includes('conflict') || statusCode === 440;

            console.log(chalk.red(`❌ Connexion fermée [${sessionId}]. Raison :`), reason || statusCode);

            if (isLoggedOut) {
                console.log(chalk.red(`⚠️ Déconnecté (Logged Out) [${sessionId}]. Suppression de la session.`));
                if (fs.existsSync(sessionFolder)) fs.rmSync(sessionFolder, { recursive: true, force: true });
                global.activeSessions.delete(sessionId);
                reconnectingSet.delete(sessionId);
            } else if (!reconnectingSet.has(sessionId)) {
                // Utilise reconnectingSet pour éviter les doubles reconnexions
                reconnectingSet.add(sessionId);
                const delay = isConflict ? 15000 : 5000;
                setTimeout(async () => {
                    reconnectingSet.delete(sessionId);
                    global.activeSessions.delete(sessionId);
                    await startBot(sessionId, isMaster, requestNumber);
                }, delay);
            }
        } else if (connection === 'open') {
            reconnectingSet.delete(sessionId);
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
                    } catch (e) {}
                }
            } else if (!sock.notifiedFirstTime) {
                sock.notifiedFirstTime = true;
                try {
                    const masterSock = global.activeSessions.get('master');
                    if (masterSock && sock.customOwner) {
                        await masterSock.sendMessage(`${sock.customOwner}@s.whatsapp.net`, {
                            text: `✅ *BOT DÉPLOYÉ AVEC SUCCÈS*\n\n_Votre bot a été lancé et connecté avec succès. Il est désormais prêt à l'emploi !_`
                        });
                    }
                } catch (e) {}
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            await messageHandler(sock, msg, messageCache);
        }
    });

    return sock;
}

// ─── Lancement au démarrage ──────────────────────────────────────────────────
if (require.main === module) {
    (async () => {
        await db.initDB();
        global.dbReady = true;

        console.log(chalk.blue('Chargement des modules de commandes...'));
        commandHandler.loadCommands();

        // Migrer l'ancien dossier `session` vers `sessions/master` si besoin
        const oldSession = path.join(__dirname, 'session');
        const newMaster = path.join(__dirname, 'sessions', 'master');
        if (fs.existsSync(oldSession) && !fs.existsSync(newMaster)) {
            fs.mkdirSync(path.join(__dirname, 'sessions'), { recursive: true });
            fs.renameSync(oldSession, newMaster);
            console.log(chalk.yellow('📁 Migration session → sessions/master effectuée.'));
        }

        const sessionsDir = path.join(__dirname, 'sessions');
        if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

        const folders = fs.readdirSync(sessionsDir).filter(f => {
            try { return fs.lstatSync(path.join(sessionsDir, f)).isDirectory(); } catch { return false; }
        });

        if (folders.length === 0) {
            await startBot('master', true);
        } else {
            for (const f of folders) {
                const isMaster = (f === 'master');
                const ownerMatch = f.match(/^user_(\d+)$/);
                const subOwner = ownerMatch ? ownerMatch[1] : null;
                await startBot(f, isMaster, subOwner);
                if (folders.length > 1) await new Promise(r => setTimeout(r, 2000)); // Anti-spam boot multi-sessions
            }
        }
    })().catch(e => {
        console.error(chalk.red('Erreur fatale au démarrage:'), e);
        process.exit(1);
    });
}

module.exports = { startBot };

// Arrêt propre sur SIGINT et SIGTERM
async function gracefulShutdown(signal) {
    console.log(chalk.red(`\n🚫 Signal ${signal} reçu. Arrêt propre des bots...`));
    for (const [sid, s] of global.activeSessions.entries()) {
        try { s.end(new Error('Bot stopped')); } catch {}
    }
    // Laisser 2s pour les déconnexions propres
    setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
    console.error(chalk.red('[UNCAUGHT EXCEPTION]'), err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('[UNHANDLED REJECTION]'), reason);
});
