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

const commandHandler = require('./handlers/commandHandler');
const messageHandler = require('./events/messageHandler');

const baileysLogger = pino({ level: 'silent' });
const NodeCache = require('node-cache');

// Optimisation Majeure : TTL à 15 mins au lieu de 24h pour ne pas saturer la RAM avec les SaaS
const messageCache = new NodeCache({ stdTTL: 900, checkperiod: 120, useClones: false });

// ─── VARIABLES GLOBALES ────────────────────────────────────────────────────────
global.activeSessions = new Map();
global.dbReady = false;

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
    commandHandler.loadCommands(); // Charge the commands into memory

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
            const isMaster = (f === 'master');
            const ownerMatch = f.match(/^user_(\d+)$/);
            const subOwner = ownerMatch ? ownerMatch[1] : null;
            
            await startBot(f, isMaster, subOwner);
            await new Promise(r => setTimeout(r, 2000)); // Anti-spam boot
        }
    }
    })();
}

module.exports = { startBot };

process.on('SIGINT', () => {
    console.log(chalk.red('\n🚫 Arrêt des bots.'));
    process.exit(0);
});
