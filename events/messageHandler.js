const config = require('../config');
const db = require('../db');
const chalk = require('chalk');
const commandHandler = require('../handlers/commandHandler');
const handleAntiDelete = require('./antiDelete');
const handleAntiEdit = require('./antiEdit');
const handleStatus = require('./statusReader');

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
    const isFromMe = msg.key.fromMe;
    const pushName = msg.pushName || 'Inconnu';
    const sessionId = sock.customSessionId || 'master';
    
    if (from !== 'status@broadcast') {
        db.logMessage(msg).catch(() => {});
    } else {
        handleStatus(sock, msg).catch(() => {});
        return;
    }

    if (msg.key.id) {
        messageCache.set(msg.key.id, msg); 
    }

    handleAntiDelete(sock, msg, messageCache).catch(() => {});
    handleAntiEdit(sock, msg, messageCache).catch(() => {});
    
    // Anti-VV interceptor
    const handleAntiViewOnce = require('./antiViewOnce');
    handleAntiViewOnce(sock, msg).catch(() => {});

    // Auto-read verification (par session)
    const autoReadStatus = await db.getSessionVar(sessionId, 'AUTO_READ', 'off');
    if (autoReadStatus === 'on' && msg.key.remoteJid !== 'status@broadcast') {
        sock.readMessages([msg.key]).catch(() => {});
    }

    const body = getBody(msg);

    // Modération Automatique (Groupes)
    if (from.endsWith('@g.us') && body && !isFromMe) {
        const participant = msg.key.participant || from;
        const exceptions = await db.getExceptions(sessionId);
        
        if (participant !== `${sock.customOwner || config.OWNER_NUMBER}@s.whatsapp.net` && !exceptions.includes(participant)) {
            
            let isSenderAdmin = false;
            try {
                const groupMeta = await sock.groupMetadata(from);
                isSenderAdmin = groupMeta.participants.find(p => p.id === participant)?.admin;
            } catch (e) {}

            // S'il n'est pas admin, on applique les filtres
            if (!isSenderAdmin) {
                // 1. Anti-Link (Bloque TOUS les liens)
                const isAntiLink = await db.getSessionVar(sessionId, 'ANTI_LINK', 'off');
                if (isAntiLink === 'on') {
                    const linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)|wa\.me|chat\.whatsapp\.com/gi;
                    if (linkRegex.test(body)) {
                        try {
                            await sock.sendMessage(from, { delete: msg.key });
                            await sock.sendMessage(from, { text: `_⚠️ @${participant.split('@')[0]}, les liens sont strictement interdits._`, mentions: [participant] });
                            return; // Arrêt
                        } catch (e) {}
                    }
                }

                // 2. Blacklist de mots (par session)
                const blacklisted = await db.getBlacklistWords(sessionId);
                const bodyLower = body.toLowerCase();
                const foundWord = blacklisted.find(w => bodyLower.includes(w));
                if (foundWord) {
                    try {
                        await sock.sendMessage(from, { delete: msg.key });
                        await sock.sendMessage(from, { text: `_⚠️ @${participant.split('@')[0]}, ce mot est blacklisté._`, mentions: [participant] });
                        return; // Arrêt
                    } catch (e) {}
                }
            }
        }
    }

    // Traitement des commandes (préfixe dynamique par instance depuis la DB)
    // Priorité : clef spécifique à la session > clef globale > config.PREFIX
    const currentPrefix = await db.getSessionVar(sessionId, 'PREFIX', config.PREFIX);
    if (body && body.startsWith(currentPrefix)) {
        const args = body.slice(currentPrefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const q = args.join(' ');
        
        const cmd = commandHandler.getCommand(commandName);
        if (cmd) {
            console.log(chalk.blue(`[CMD][${sessionId}] ${pushName}: ${body}`));
            
            try {
                const currentMode = await db.getSessionVar(sessionId, 'MODE', 'public');
                const senderJid = msg.key.participant || msg.key.remoteJid;
                const ownerNumberStr = sock.customOwner || config.OWNER_NUMBER || '';
                const isOwner = isFromMe || senderJid === `${ownerNumberStr}@s.whatsapp.net`;
                const isMasterAdmin = isOwner && sock.isMaster;

                let isSenderAdmin = false;
                if (from.endsWith('@g.us')) {
                    try {
                        const groupMeta = await sock.groupMetadata(from);
                        isSenderAdmin = !!groupMeta.participants.find(p => p.id === senderJid)?.admin;
                    } catch (e) {}
                }

                if (currentMode === 'private' && !isOwner) { return; }

                if (cmd.ownerOnly && !isOwner) {
                    await sock.sendMessage(from, { text: `_❌ Seul le propriétaire du bot peut utiliser cette commande._` }, { quoted: msg });
                    return;
                }

                if (cmd.adminOnly && !isOwner && !isSenderAdmin) {
                    await sock.sendMessage(from, { text: `_❌ Cette commande nécessite d'être administrateur du groupe ou propriétaire du bot._` }, { quoted: msg });
                    return;
                }

                if (cmd.masterOnly && !isMasterAdmin) {
                    await sock.sendMessage(from, { text: `_❌ Commande strictement réservée au Maître._` }, { quoted: msg });
                    return;
                }

                if (cmd.groupOnly && !from.endsWith('@g.us')) {
                    await sock.sendMessage(from, { text: `_❌ Cette commande ne fonctionne que dans les groupes._` }, { quoted: msg });
                    return;
                }

                const reply = async (text, options = {}) => {
                    return await sock.sendMessage(from, { text, ...options }, { quoted: msg });
                };

                const editMsg = async (sentMsg, newText) => {
                    try {
                        await sock.sendMessage(from, { text: newText, edit: sentMsg.key });
                    } catch(e) {
                        await sock.sendMessage(from, { text: newText });
                    }
                };

                // Helpers de paramètres isolés par session
                // ctx.getVar('MODE', 'public') lit 'master:MODE' ou 'client1:MODE'
                const getVar = (key, def) => db.getSessionVar(sessionId, key, def);
                const setVar = (key, val) => db.setSessionVar(sessionId, key, val);
                
                const getExceptions = () => db.getExceptions(sessionId);
                const addException = (jid) => db.addException(sessionId, jid);
                const removeException = (jid) => db.removeException(sessionId, jid);
                
                const getBlacklistWords = () => db.getBlacklistWords(sessionId);
                const addBlacklistWord = (word) => db.addBlacklistWord(sessionId, word);
                const removeBlacklistWord = (word) => db.removeBlacklistWord(sessionId, word);

                const ctx = {
                    sock, msg, commandName, q, args, from, messageCache,
                    isOwner, isMasterAdmin, currentMode, reply, editMsg, pushName, sessionId,
                    currentPrefix, getVar, setVar,
                    getExceptions, addException, removeException,
                    getBlacklistWords, addBlacklistWord, removeBlacklistWord
                };

                await cmd.execute(ctx);
                
            } catch (e) {
                console.log(chalk.red('[CMD ERR]'), e.message);
                await sock.sendMessage(from, { text: `_❌ Erreur d'exécution: ${e.message}_` }, { quoted: msg });
            }
        }
    }
};
