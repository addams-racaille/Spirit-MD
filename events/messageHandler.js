const config = require('../config');
const db = require('../db');
const chalk = require('chalk');
const commandHandler = require('../handlers/commandHandler');
const handleAntiDelete = require('./antiDelete');
const handleAntiEdit = require('./antiEdit');
const handleStatus = require('./statusReader');
// Import au niveau module pour éviter le require() dans la boucle chaude
const handleAntiViewOnce = require('./antiViewOnce');

// Cache en mémoire pour les réglages par session (évite une requête DB par message)
const sessionVarCache = new Map(); // key: "sessionId:KEY" → { value, expiresAt }
const SESSION_CACHE_TTL = 30000; // 30 secondes

async function getCachedSessionVar(sessionId, key, defaultValue) {
    const cacheKey = `${sessionId}:${key}`;
    const now = Date.now();
    const cached = sessionVarCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.value;
    const value = await db.getSessionVar(sessionId, key, defaultValue);
    sessionVarCache.set(cacheKey, { value, expiresAt: now + SESSION_CACHE_TTL });
    return value;
}

// Invalide le cache quand une commande modifie un réglage
function invalidateSessionCache(sessionId, key) {
    sessionVarCache.delete(`${sessionId}:${key}`);
}

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

module.exports = async (sock, msg, messageCache) => {
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    if (!from) return;

    const isFromMe = msg.key.fromMe;
    const pushName = msg.pushName || 'Inconnu';
    const sessionId = sock.customSessionId || 'master';

    // Traitement des statuts
    if (from === 'status@broadcast') {
        handleStatus(sock, msg).catch(() => {});
        return;
    }

    // Log du message en DB (asynchrone, non bloquant)
    db.logMessage(msg).catch(() => {});

    // Cache du message pour anti-delete/edit
    if (msg.key.id) {
        messageCache.set(msg.key.id, msg);
    }

    // Events de modération passive (parallélisés)
    handleAntiDelete(sock, msg, messageCache).catch(() => {});
    handleAntiEdit(sock, msg, messageCache).catch(() => {});
    handleAntiViewOnce(sock, msg).catch(() => {});

    // Auto-read (avec cache)
    const autoReadStatus = await getCachedSessionVar(sessionId, 'AUTO_READ', 'off');
    if (autoReadStatus === 'on') {
        sock.readMessages([msg.key]).catch(() => {});
    }

    const body = getBody(msg);
    const isGroup = from.endsWith('@g.us');

    // ── Modération automatique (Groupes) ──────────────────────────────────────
    let isSenderAdmin = false; // calculé une seule fois et réutilisé

    if (isGroup && body && !isFromMe) {
        const participant = msg.key.participant || from;
        const ownerJid = `${sock.customOwner || config.OWNER_NUMBER}@s.whatsapp.net`;

        if (participant !== ownerJid) {
            const exceptions = await db.getExceptions(sessionId);

            if (!exceptions.includes(participant)) {
                // Récupération admins du groupe (une seule fois)
                try {
                    const groupMeta = await sock.groupMetadata(from);
                    isSenderAdmin = !!groupMeta.participants.find(p => p.id === participant)?.admin;
                } catch (e) {}

                if (!isSenderAdmin) {
                    // 1. Anti-Link
                    const isAntiLink = await getCachedSessionVar(sessionId, 'ANTI_LINK', 'off');
                    if (isAntiLink === 'on') {
                        const linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)|wa\.me|chat\.whatsapp\.com/gi;
                        if (linkRegex.test(body)) {
                            try {
                                await sock.sendMessage(from, { delete: msg.key });
                                await sock.sendMessage(from, {
                                    text: `_⚠️ @${participant.split('@')[0]}, les liens sont strictement interdits._`,
                                    mentions: [participant]
                                });
                            } catch (e) {}
                            return;
                        }
                    }

                    // 2. Blacklist de mots
                    const blacklisted = await db.getBlacklistWords(sessionId);
                    if (blacklisted.length > 0) {
                        const bodyLower = body.toLowerCase();
                        const foundWord = blacklisted.find(w => bodyLower.includes(w));
                        if (foundWord) {
                            try {
                                await sock.sendMessage(from, { delete: msg.key });
                                await sock.sendMessage(from, {
                                    text: `_⚠️ @${participant.split('@')[0]}, ce mot est blacklisté._`,
                                    mentions: [participant]
                                });
                            } catch (e) {}
                            return;
                        }
                    }
                }
            }
        }
    }

    // ── Traitement des commandes ──────────────────────────────────────────────
    const currentPrefix = await getCachedSessionVar(sessionId, 'PREFIX', config.PREFIX);
    if (!body || !body.startsWith(currentPrefix)) return;

    const args = body.slice(currentPrefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const q = args.join(' ');

    const cmd = commandHandler.getCommand(commandName);
    if (!cmd) return;

    console.log(chalk.blue(`[CMD][${sessionId}] ${pushName}: ${body}`));

    try {
        const currentMode = await getCachedSessionVar(sessionId, 'MODE', 'public');
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const ownerNumberStr = sock.customOwner || config.OWNER_NUMBER || '';
        const isOwner = isFromMe || senderJid === `${ownerNumberStr}@s.whatsapp.net`;
        const isMasterAdmin = isOwner && sock.isMaster;

        // Réutilise isSenderAdmin si déjà calculé pour modération, sinon le calcule
        if (isGroup && !isSenderAdmin) {
            try {
                const groupMeta = await sock.groupMetadata(from);
                isSenderAdmin = !!groupMeta.participants.find(p => p.id === senderJid)?.admin;
            } catch (e) {}
        }

        if (currentMode === 'private' && !isOwner) return;
        if (cmd.ownerOnly && !isOwner) {
            return await sock.sendMessage(from, { text: `_❌ Seul le propriétaire du bot peut utiliser cette commande._` }, { quoted: msg });
        }
        if (cmd.adminOnly && !isOwner && !isSenderAdmin) {
            return await sock.sendMessage(from, { text: `_❌ Cette commande nécessite d'être administrateur du groupe ou propriétaire du bot._` }, { quoted: msg });
        }
        if (cmd.masterOnly && !isMasterAdmin) {
            return await sock.sendMessage(from, { text: `_❌ Commande strictement réservée au Maître._` }, { quoted: msg });
        }
        if (cmd.groupOnly && !isGroup) {
            return await sock.sendMessage(from, { text: `_❌ Cette commande ne fonctionne que dans les groupes._` }, { quoted: msg });
        }

        const reply = async (text, options = {}) =>
            await sock.sendMessage(from, { text, ...options }, { quoted: msg });

        const editMsg = async (sentMsg, newText) => {
            try {
                await sock.sendMessage(from, { text: newText, edit: sentMsg.key });
            } catch (e) {
                await sock.sendMessage(from, { text: newText });
            }
        };

        // Wrappers session-isolés avec invalidation du cache sur écriture
        const getVar = (key, def) => getCachedSessionVar(sessionId, key, def);
        const setVar = async (key, val) => {
            await db.setSessionVar(sessionId, key, val);
            invalidateSessionCache(sessionId, key);
        };

        const getExceptions = () => db.getExceptions(sessionId);
        const addException = (jid) => db.addException(sessionId, jid);
        const removeException = (jid) => db.removeException(sessionId, jid);

        const getBlacklistWords = () => db.getBlacklistWords(sessionId);
        const addBlacklistWord = (word) => db.addBlacklistWord(sessionId, word);
        const removeBlacklistWord = (word) => db.removeBlacklistWord(sessionId, word);

        const ctx = {
            sock, msg, commandName, q, args, from, messageCache,
            isOwner, isMasterAdmin, isSenderAdmin, currentMode,
            reply, editMsg, pushName, sessionId,
            currentPrefix, getVar, setVar,
            getExceptions, addException, removeException,
            getBlacklistWords, addBlacklistWord, removeBlacklistWord,
        };

        await cmd.execute(ctx);

    } catch (e) {
        console.log(chalk.red('[CMD ERR]'), e.message);
        try {
            await sock.sendMessage(from, { text: `_❌ Erreur d'exécution: ${e.message}_` }, { quoted: msg });
        } catch {}
    }
};
