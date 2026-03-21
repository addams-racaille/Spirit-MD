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
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const config = require('./config');

// Chargeurs des event handlers
const handleStatus = require('./events/statusReader');
const handleAntiDelete = require('./events/antiDelete');
const handleAntiEdit = require('./events/antiEdit');

// Filtrer les logs internes de Baileys qui polluent le terminal
// On utilise pino en mode 'silent' pour ne jamais voir les logs internes de Baileys
const baileysLogger = pino({ level: 'silent' });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const NodeCache = require('node-cache');

// Cache optimisé pour Anti-Delete et Anti-Edit (expire automatiquement après 24h sans bloquer l'Event Loop)
const messageCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600, useClones: false });
let isReconnecting = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Bot principal ─────────────────────────────────────────────────────────────
async function startBot(isRetry = false) {
    if (!isRetry) {
        console.clear();
        console.log(chalk.cyan(figlet.textSync('Mon Bot', { horizontalLayout: 'full' })));
        console.log(chalk.green('🚀 Initialisation du bot...\n'));
        
        // Initialiser la base de données au démarrage
        await db.initDB();
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: baileysLogger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: true,
        shouldSyncHistoryMessage: () => false,
    });

    // ── Pairing Code ──────────────────────────────────────────────────────────
    if (!sock.authState.creds.registered) {
        console.log(chalk.yellow('⚠️ Aucune session trouvée.'));
        const phoneNumber = await question(chalk.green("Entrez votre numéro WhatsApp (ex: 33612345678) : "));
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(cleanNumber);
                const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(chalk.cyan('\n============================================='));
                console.log(chalk.white(' 🔗 VOTRE CODE : '), chalk.yellow.bold(formatted));
                console.log(chalk.cyan('=============================================\n'));
                console.log(chalk.white('Entrez ce code dans WhatsApp → Appareils liés → Lier avec numéro.\n'));
            } catch (err) {
                console.log(chalk.red('Erreur Pairing Code :'), err.message);
            }
        }, 3000);
    } else {
        console.log(chalk.green('✅ Session existante chargée. Connexion en cours...'));
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

            console.log(chalk.red('❌ Connexion fermée. Raison :'), reason || statusCode);

            if (isLoggedOut) {
                console.log(chalk.red('⚠️ Déconnecté (Logged Out). Supprimez le dossier "session" et relancez.'));
                process.exit(1);
            } else if (!isReconnecting) {
                isReconnecting = true;
                const delay = isConflict ? 15000 : 5000;
                const msg = isConflict
                    ? '⚠️ Conflit : une autre instance est active. Attente 15s...'
                    : '🔄 Reconnexion dans 5 secondes...';
                console.log(chalk.yellow(msg));
                setTimeout(() => { isReconnecting = false; startBot(true); }, delay);
            }
        } else if (connection === 'open') {
            isReconnecting = false;
            console.log(chalk.cyan(figlet.textSync('Connecte !', { horizontalLayout: 'full' })));
            console.log(chalk.green('✅ Bot connecté et prêt !'));
            console.log(chalk.white(' - Always Online     : ✅'));
            console.log(chalk.white(' - Status Autoliker  : ✅'));
            console.log(chalk.white(' - Anti-Delete/Edit  : ✅'));
            console.log(chalk.white(' - Base de données   : ✅\n'));
        }
    });

    // ── Messages entrants ─────────────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Ignorer les notifications silencieuses
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message) continue;

            const from = msg.key.remoteJid;
            const isFromMe = msg.key.fromMe;
            const pushName = msg.pushName || 'Inconnu';
            
            // Enregistrement dans la DB SQLite (hors statuts) - ASYNCHRONE
            if (from !== 'status@broadcast') {
                db.logMessage(msg).catch(e => console.log(chalk.red('Err DB log:'), e.message));
            }

            // ── Événements extérieurs centralisés ──────────────────────────
            if (from === 'status@broadcast') {
                handleStatus(sock, msg).catch(e => console.log(chalk.red('Err handleStatus:'), e.message));
                continue;
            }

            // Gestion de la sauvegarde des messages pour l'Anti-Delete/Edit
            if (msg.key.id) {
                messageCache.set(msg.key.id, msg);
            }

            // Gestion Anti-Delete - ASYNCHRONE
            handleAntiDelete(sock, msg, messageCache).catch(e => console.log(chalk.red('Err handleAntiDelete:'), e.message));

            // Gestion Anti-Edit - ASYNCHRONE
            handleAntiEdit(sock, msg, messageCache).catch(e => console.log(chalk.red('Err handleAntiEdit:'), e.message));

            const body = getBody(msg);

            // ── Filtrage Blacklist ───────────────────────────────────────────
            if (from.endsWith('@g.us') && body && !isFromMe) {
                const participant = msg.key.participant || from;
                const exceptions = await db.getExceptions();
                
                // Ne pas filtrer le propriétaire ni les exceptions
                if (participant !== `${config.OWNER_NUMBER}@s.whatsapp.net` && !exceptions.includes(participant)) {
                    const blacklisted = await db.getBlacklistWords();
                    const bodyLower = body.toLowerCase();
                    // On vérifie s'il contient un des mots de la blacklist (entouré de limites de mots ou pas selon le besoin, ici on fait simple on check la présence brute)
                    const foundWord = blacklisted.find(w => bodyLower.includes(w));
                    if (foundWord) {
                        console.log(chalk.red(`[BLACKLIST] Mot interdit détecté ("${foundWord}"), suppression...`));
                        try {
                            await sock.sendMessage(from, { delete: msg.key });
                            await sock.sendMessage(from, { text: `_⚠️ @${participant.split('@')[0]}, l'utilisation de ce mot est interdite ici._`, mentions: [participant] });
                            continue; // On bloque la suite du traitement
                        } catch (e) {
                            console.log(chalk.red('Err suppression blacklist:'), e.message);
                        }
                    }
                }
            }

            // ── Commandes (acceptées depuis n'importe qui, y compris fromMe) ─
            if (body && body.startsWith(config.PREFIX)) {
                console.log(chalk.blue(`[CMD${isFromMe ? '/MOI' : ''}] ${pushName}: ${body}`));
                const args = body.slice(config.PREFIX.length).trim().split(/ +/);
                const commandName = args.shift().toLowerCase();
                const q = args.join(' ');
                
                // Exécution de la commande en arrière-plan pour ne pas bloquer les autres
                try {
                    require('./commands')(sock, msg, commandName, q, from)
                        .catch(e => console.log(chalk.red('[CMD REJET]'), e.message));
                } catch (e) {
                    console.log(chalk.red('[CMD ERR]'), e.message);
                }
            }
        }
    });
}


startBot();

process.on('SIGINT', () => {
    console.log(chalk.red('\n🚫 Arrêt du bot.'));
    process.exit(0);
});
