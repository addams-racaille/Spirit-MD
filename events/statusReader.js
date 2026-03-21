const chalk = require('chalk');
const db = require('../db');

module.exports = async function handleStatus(sock, msg) {
    const from = msg.key.remoteJid;
    if (from !== 'status@broadcast') return;

    const statusMode = await db.getVar('AUTO_STATUS', 'like');
    if (statusMode === 'off') return;

    const pushName = msg.pushName || 'Inconnu';
    const participantJid = msg.key.participant || from;
    
    try {
        await sock.readMessages([{
            remoteJid: 'status@broadcast',
            id: msg.key.id,
            participant: participantJid,
        }]);
        console.log(chalk.magenta(`👀 Statut vu de : ${pushName}`));
    } catch (e) {
        console.log(chalk.red('Err vue statut:'), e.message);
    }
    
    // 2. Liker (réagir avec un coeur) uniquement en mode "like"
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
                console.log(chalk.red('Err like statut:'), e.message);
            }
        }, 2000);
    }
};
