const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDB() {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    // WAL pour les écritures concurrentes + perf générale
    await db.exec('PRAGMA journal_mode = WAL;');
    await db.exec('PRAGMA synchronous = NORMAL;');
    await db.exec('PRAGMA cache_size = -8000;'); // 8 MB de cache
    await db.exec('PRAGMA temp_store = MEMORY;');
    await db.exec('PRAGMA foreign_keys = ON;');

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            jid TEXT,
            chatJid TEXT,
            name TEXT,
            totalMessages INTEGER DEFAULT 0,
            textMessages INTEGER DEFAULT 0,
            imageMessages INTEGER DEFAULT 0,
            videoMessages INTEGER DEFAULT 0,
            audioMessages INTEGER DEFAULT 0,
            stickerMessages INTEGER DEFAULT 0,
            otherMessages INTEGER DEFAULT 0,
            lastMessageAt DATETIME,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (jid, chatJid)
        )
    `);

    // Index pour les requêtes fréquentes
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_users_chatJid ON users(chatJid);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_users_totalMessages ON users(totalMessages DESC);`);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS warnings (
            jid TEXT,
            chatJid TEXT,
            count INTEGER DEFAULT 0,
            PRIMARY KEY (jid, chatJid)
        )
    `);

    await db.exec(`CREATE INDEX IF NOT EXISTS idx_warnings_chat ON warnings(jid, chatJid);`);

    console.log('📦 Base de données SQLite prête.');
}

// Types de messages autorisés (évite l'injection SQL via colonne dynamique)
const ALLOWED_TYPES = new Set(['text', 'image', 'video', 'audio', 'sticker', 'other']);

async function logMessage(msg) {
    if (!db) return;
    if (!msg.message) return;

    const jid = msg.key.participant || msg.key.remoteJid;
    const chatJid = msg.key.remoteJid;
    if (!jid || !chatJid) return;

    const name = (msg.pushName || 'Inconnu').slice(0, 100); // limite la taille
    const lastMessageAt = new Date().toISOString();

    const m = msg.message;
    let type = 'other';
    if (m.conversation || m.extendedTextMessage) type = 'text';
    else if (m.imageMessage) type = 'image';
    else if (m.videoMessage) type = 'video';
    else if (m.audioMessage) type = 'audio';
    else if (m.stickerMessage) type = 'sticker';

    // Validation stricte du type avant utilisation dans la requête SQL
    if (!ALLOWED_TYPES.has(type)) type = 'other';

    // Utilisation de colonnes statiques avec un mapping pour éviter toute injection
    const colMap = {
        text:    'textMessages',
        image:   'imageMessages',
        video:   'videoMessages',
        audio:   'audioMessages',
        sticker: 'stickerMessages',
        other:   'otherMessages',
    };
    const col = colMap[type];

    await db.run(`
        INSERT INTO users (jid, chatJid, name, totalMessages, ${col}, lastMessageAt)
        VALUES (?, ?, ?, 1, 1, ?)
        ON CONFLICT(jid, chatJid) DO UPDATE SET
            name = excluded.name,
            totalMessages = totalMessages + 1,
            ${col} = ${col} + 1,
            lastMessageAt = excluded.lastMessageAt
    `, [jid, chatJid, name, lastMessageAt]);
}

async function fetchFromStore(chatJid) {
    if (!db) return [];
    return await db.all('SELECT * FROM users WHERE chatJid = ? COLLATE NOCASE', [chatJid]);
}

async function getTopUsers(chatJid, limit = 10) {
    if (!db) return [];
    return await db.all(
        'SELECT * FROM users WHERE chatJid = ? COLLATE NOCASE ORDER BY totalMessages DESC LIMIT ?',
        [chatJid, limit]
    );
}

async function getGlobalTopUsers(limit = 10) {
    if (!db) return [];
    return await db.all(`
        SELECT jid, MAX(name) as name, SUM(totalMessages) as totalMessages, MAX(lastMessageAt) as lastMessageAt
        FROM users
        GROUP BY jid
        ORDER BY totalMessages DESC
        LIMIT ?
    `, [limit]);
}

// ── Paramètres globaux (settings) ──

async function setVar(key, value) {
    if (!db) return;
    await db.run(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [key, String(value)]);
}

async function getVar(key, defaultValue = null) {
    if (!db) return defaultValue;
    const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : defaultValue;
}

// ── Paramètres de session isolés par instance ──
// Clé stockée sous la forme "<sessionId>:<key>"

async function setSessionVar(sessionId, key, value) {
    const sessionKey = `${sessionId}:${key}`;
    await setVar(sessionKey, value);
}

async function getSessionVar(sessionId, key, defaultValue = null) {
    const sessionKey = `${sessionId}:${key}`;
    return await getVar(sessionKey, defaultValue);
}

// ── Exceptions (groupes ou users ignorés par session) ──

async function getExceptions(sessionId) {
    const data = await getSessionVar(sessionId, 'EXCEPTIONS', '[]');
    try { return JSON.parse(data); } catch (e) { return []; }
}

async function addException(sessionId, jid) {
    const list = await getExceptions(sessionId);
    if (!list.includes(jid)) {
        list.push(jid);
        await setSessionVar(sessionId, 'EXCEPTIONS', JSON.stringify(list));
    }
}

async function removeException(sessionId, jid) {
    let list = await getExceptions(sessionId);
    list = list.filter(item => item !== jid);
    await setSessionVar(sessionId, 'EXCEPTIONS', JSON.stringify(list));
}

// ── Avertissements ──

async function addWarning(jid, chatJid) {
    if (!db) return 1;
    await db.run(`
        INSERT INTO warnings (jid, chatJid, count) VALUES (?, ?, 1)
        ON CONFLICT(jid, chatJid) DO UPDATE SET count = count + 1
    `, [jid, chatJid]);
    const row = await db.get('SELECT count FROM warnings WHERE jid = ? AND chatJid = ?', [jid, chatJid]);
    return row ? row.count : 1;
}

async function getWarnings(jid, chatJid) {
    if (!db) return 0;
    const row = await db.get('SELECT count FROM warnings WHERE jid = ? AND chatJid = ?', [jid, chatJid]);
    return row ? row.count : 0;
}

async function resetWarnings(jid, chatJid) {
    if (!db) return;
    await db.run('DELETE FROM warnings WHERE jid = ? AND chatJid = ?', [jid, chatJid]);
}

// ── Blacklist (mots interdits par session) ──

async function getBlacklistWords(sessionId) {
    const data = await getSessionVar(sessionId, 'BLACKLIST', '[]');
    try { return JSON.parse(data); } catch (e) { return []; }
}

async function addBlacklistWord(sessionId, word) {
    const list = await getBlacklistWords(sessionId);
    if (!list.includes(word)) {
        list.push(word);
        await setSessionVar(sessionId, 'BLACKLIST', JSON.stringify(list));
    }
}

async function removeBlacklistWord(sessionId, word) {
    let list = await getBlacklistWords(sessionId);
    list = list.filter(w => w !== word);
    await setSessionVar(sessionId, 'BLACKLIST', JSON.stringify(list));
}

// ── Nettoyage des stats anciennes ──
async function pruneOldMessageStats(days = 90) {
    if (!db) return;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { changes } = await db.run(
        'DELETE FROM users WHERE lastMessageAt < ? AND totalMessages < 5',
        [cutoff]
    );
    if (changes > 0) console.log(`🗑️ ${changes} entrée(s) inactives supprimées de la base.`);
}

module.exports = {
    initDB,
    logMessage,
    fetchFromStore,
    getTopUsers,
    getGlobalTopUsers,
    setVar,
    getVar,
    getSessionVar,
    setSessionVar,
    getExceptions,
    addException,
    removeException,
    addWarning,
    getWarnings,
    resetWarnings,
    addBlacklistWord,
    removeBlacklistWord,
    getBlacklistWords,
    pruneOldMessageStats,
};
