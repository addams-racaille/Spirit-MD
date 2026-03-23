const chalk = require('chalk');
const db = require('../db');

module.exports = async function handleStatus(sock, msg) {
    const sessionId = sock.customSessionId || 'master';
    const from = msg.key.remoteJid;
    if (from !== 'status@broadcast') return;

    // Ne pas réagir à ses propres statuts
    if (msg.key.fromMe) return;

    const statusMode = await db.getSessionVar(sessionId, 'AUTO_STATUS', 'like');
    if (statusMode === 'off') return;

    const pushName = msg.pushName || 'Inconnu';
    const participantJid = msg.key.participant;

    // Sans participant JID valide, on ne peut ni lire ni liker
    if (!participantJid || participantJid === 'status@broadcast') return;

    // 1. Marquer comme vu
    try {
        await sock.readMessages([{
            remoteJid: 'status@broadcast',
            id: msg.key.id,
            participant: participantJid,
        }]);
        console.log(chalk.magenta(`👀 Statut vu de : ${pushName}`));
    } catch (e) {
        // Silencieux — la lecture peut échouer si le statut a expiré
    }

    // 2. Liker uniquement en mode "like"
    if (statusMode === 'like') {
        setTimeout(async () => {
            try {
                await sock.sendMessage(participantJid, {
                    react: {
                        text: '💚',
                        key: msg.key
                    }
                });
                console.log(chalk.green(`💚 Statut liké : ${pushName}`));
            } catch (e) {
                // Silencieux — le like peut échouer si le statut a expiré
            }
        }, 2000);
    }
};
