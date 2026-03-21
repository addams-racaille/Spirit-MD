const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDB() {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    await db.exec('PRAGMA journal_mode = WAL;'); // Optimisation de performance essentielle pour VPS

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

    await db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS exceptions (
            jid TEXT PRIMARY KEY
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

    await db.exec(`
        CREATE TABLE IF NOT EXISTS blacklist (
            word TEXT PRIMARY KEY
        )
    `);
    
    console.log('📦 Base de données SQLite prête.');
}

async function logMessage(msg) {
    if (!db) return;
    if (!msg.message) return;

    const jid = msg.key.participant || msg.key.remoteJid;
    const chatJid = msg.key.remoteJid;
    const name = msg.pushName || 'Inconnu';
    const lastMessageAt = new Date().toISOString();

    const m = msg.message;
    let type = 'other';
    
    if (m.conversation || m.extendedTextMessage) type = 'text';
    else if (m.imageMessage) type = 'image';
    else if (m.videoMessage) type = 'video';
    else if (m.audioMessage) type = 'audio';
    else if (m.stickerMessage) type = 'sticker';

    await db.run(`
        INSERT INTO users (jid, chatJid, name, totalMessages, ${type}Messages, lastMessageAt)
        VALUES (?, ?, ?, 1, 1, ?)
        ON CONFLICT(jid, chatJid) DO UPDATE SET
            name = excluded.name,
            totalMessages = totalMessages + 1,
            ${type}Messages = ${type}Messages + 1,
            lastMessageAt = excluded.lastMessageAt
    `, [jid, chatJid, name, lastMessageAt]);
}

async function fetchFromStore(chatJid) {
    return await db.all('SELECT * FROM users WHERE chatJid = ? COLLATE NOCASE', [chatJid]);
}

async function getTopUsers(chatJid, limit = 10) {
    return await db.all('SELECT * FROM users WHERE chatJid = ? COLLATE NOCASE ORDER BY totalMessages DESC LIMIT ?', [chatJid, limit]);
}

async function getGlobalTopUsers(limit = 10) {
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
    await db.run(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [key, value]);
}

async function getVar(key, defaultValue = null) {
    const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : defaultValue;
}

// ── Exceptions (groupes ou users ignorés) ──

async function getExceptions() {
    const rows = await db.all('SELECT jid FROM exceptions');
    return rows.map(r => r.jid);
}

async function addException(jid) {
    await db.run('INSERT OR IGNORE INTO exceptions (jid) VALUES (?)', [jid]);
}

async function removeException(jid) {
    await db.run('DELETE FROM exceptions WHERE jid = ?', [jid]);
}

// ── Avertissements ──

async function addWarning(jid, chatJid) {
    await db.run(`
        INSERT INTO warnings (jid, chatJid, count) VALUES (?, ?, 1)
        ON CONFLICT(jid, chatJid) DO UPDATE SET count = count + 1
    `, [jid, chatJid]);
    const row = await db.get('SELECT count FROM warnings WHERE jid = ? AND chatJid = ?', [jid, chatJid]);
    return row ? row.count : 1;
}

async function getWarnings(jid, chatJid) {
    const row = await db.get('SELECT count FROM warnings WHERE jid = ? AND chatJid = ?', [jid, chatJid]);
    return row ? row.count : 0;
}

async function resetWarnings(jid, chatJid) {
    await db.run('DELETE FROM warnings WHERE jid = ? AND chatJid = ?', [jid, chatJid]);
}

// ── Blacklist de Mots ──

async function addBlacklistWord(word) {
    await db.run('INSERT OR IGNORE INTO blacklist (word) VALUES (?)', [word.toLowerCase()]);
}

async function removeBlacklistWord(word) {
    await db.run('DELETE FROM blacklist WHERE word = ?', [word.toLowerCase()]);
}

async function getBlacklistWords() {
    const rows = await db.all('SELECT word FROM blacklist');
    return rows.map(r => r.word);
}

module.exports = {
    initDB,
    logMessage,
    fetchFromStore,
    getTopUsers,
    getGlobalTopUsers,
    setVar,
    getVar,
    getExceptions,
    addException,
    removeException,
    addWarning,
    getWarnings,
    resetWarnings,
    addBlacklistWord,
    removeBlacklistWord,
    getBlacklistWords
};
