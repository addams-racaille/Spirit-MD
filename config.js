require('dotenv').config();

module.exports = {
    PREFIX: process.env.PREFIX || '.',
    BOT_NAME: process.env.BOT_NAME || 'Spirit MD',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '22658606907', // Utilisé pour l'owner et isOwner
};
