const db = require('../db');

module.exports = [
    {
        name: 'config',
        adminOnly: true,
        execute: async (ctx) => {
            const { reply } = ctx;
            const currentMode = await db.getVar('MODE', 'public');
            const antiDeleteMode = await db.getVar('ANTI_DELETE', 'chat');
            const antiEditMode = await db.getVar('ANTI_EDIT', 'chat');
            const autoStatusMode = await db.getVar('AUTO_STATUS', 'like');
            const exceptionsList = await db.getExceptions();

            let configText = `⚙️ *CONFIGURATION DU BOT*\n\n`;
            configText += `*Mode Global :* ${currentMode.toUpperCase()}\n`;
            configText += `*Auto-Status :* ${autoStatusMode.toUpperCase()}\n`;
            configText += `*Anti-Delete :* ${antiDeleteMode.toUpperCase()}\n`;
            configText += `*Anti-Edit   :* ${antiEditMode.toUpperCase()}\n\n`;
            configText += `*Exceptions (${exceptionsList.length}) :*\n`;
            if (exceptionsList.length > 0) {
                exceptionsList.forEach(e => configText += `- ${e}\n`);
            } else {
                configText += `_Aucune exception_`;
            }
            return await reply(configText);
        }
    },
    {
        name: 'except',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const args = q.trim().split(/ +/);
            const action = args[0]?.toLowerCase();
            const target = args[1];

            if (!action || (action !== 'list' && !target)) {
                return await reply(
                    `_*Exceptions Manager*_\n_Ignore l'Anti-Delete et l'Anti-Edit pour certains chats_\n\n` +
                    `_Utilisation :_\n` +
                    `\`.except add <jid>\` - Ajouter une exception\n` +
                    `\`.except remove <jid>\` - Retirer une exception\n` +
                    `\`.except list\` - Voir les exceptions\n\n` +
                    `_Exemples de JID :_\n` +
                    `- Utilisateur : \`123456789@s.whatsapp.net\`\n` +
                    `- Groupe : \`123456-789@g.us\``
                );
            }

            if (action === 'list') {
                const exceptionsList = await db.getExceptions();
                if (exceptionsList.length === 0) return await reply(`_Aucune exception configurée._`);
                let msg = `*Liste des Exceptions :*\n\n`;
                exceptionsList.forEach(e => msg += `- ${e}\n`);
                return await reply(msg);
            }

            if (!target.includes('@')) {
                return await reply(`_Format invalide. L'ID doit contenir @s.whatsapp.net ou @g.us_`);
            }

            if (action === 'add') {
                await db.addException(target);
                return await reply(`_✅ Ajouté aux exceptions : ${target}_`);
            } else if (action === 'remove') {
                await db.removeException(target);
                return await reply(`_❌ Retiré des exceptions : ${target}_`);
            } else {
                return await reply(`_Action invalide._`);
            }
        }
    },
    {
        name: 'autostatus',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            let target = q.toLowerCase().trim();
            const currentStatus = await db.getVar('AUTO_STATUS', 'like');

            if (!target) {
                return await reply(
                    `_*Auto Status*_\n_Gère la lecture de statuts WhatsApp_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`.autostatus like\` - lit et like (💚) automatiquement\n` +
                    `\`.autostatus view\` - lit sans réagir\n` +
                    `\`.autostatus off\` - désactive la fonctionnalité`
                );
            }

            if (['like', 'view', 'off'].includes(target)) {
                await db.setVar('AUTO_STATUS', target);
                const emoji = target === 'like' ? '💚' : target === 'view' ? '👀' : '❌';
                return await reply(`_✅ Auto-Status configuré sur : ${target} ${emoji}_`);
            } else {
                return await reply(`_Option invalide. Tapez \`.autostatus\` pour voir l'aide._`);
            }
        }
    },
    {
        name: 'mode',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const newMode = q.toLowerCase().trim();
            if (newMode === 'public' || newMode === 'private') {
                await db.setVar('MODE', newMode);
                return await reply(`_✅ Le mode du bot a été défini sur : *${newMode}*_`);
            } else {
                const currentMode = await db.getVar('MODE', 'public');
                return await reply(`_*Mode manager*_\n_Mode actuel : ${currentMode}_\n_Utilisation : \`.mode public|private\`_`);
            }
        }
    },
    {
        name: 'antidelete',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            let target = q.toLowerCase().trim();
            const currentStatus = await db.getVar('ANTI_DELETE', 'chat');

            if (!target) {
                return await reply(
                    `_*Anti delete*_\n_Récupère les messages supprimés et les renvoie_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`.antidelete chat\` - envoie dans le chat original\n` +
                    `\`.antidelete sudo\` - envoie au propriétaire (sudo)\n` +
                    `\`.antidelete <jid>\` - envoie à un numéro/groupe spécifique\n` +
                    `\`.antidelete off\` - désactive l'anti-delete`
                );
            }

            if (target === 'off') {
                await db.setVar('ANTI_DELETE', 'off');
                await db.setVar('ANTI_DELETE_JID', '');
                return await reply(`_Anti-delete désactivé ❌_`);
            } else if (target === 'chat') {
                await db.setVar('ANTI_DELETE', 'chat');
                await db.setVar('ANTI_DELETE_JID', '');
                return await reply(`_Anti-delete activé ✅ (chat d'origine)_`);
            } else if (target === 'sudo') {
                await db.setVar('ANTI_DELETE', 'sudo');
                await db.setVar('ANTI_DELETE_JID', '');
                return await reply(`_Anti-delete activé ✅ (sudo)_`);
            } else if (target.includes('@')) {
                if (!target.match(/^\d+@(s\.whatsapp\.net|g\.us)$/)) {
                    return await reply(`_Format de numéro invalide !_`);
                }
                await db.setVar('ANTI_DELETE', 'custom');
                await db.setVar('ANTI_DELETE_JID', target);
                return await reply(`_Anti-delete activé ✅ (${target})_`);
            } else {
                return await reply(`_Option invalide. Tapez \`.antidelete\` pour voir l'aide._`);
            }
        }
    },
    {
        name: 'antiedit',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            let target = q.toLowerCase().trim();
            const currentStatus = await db.getVar('ANTI_EDIT', 'chat');

            if (!target) {
                return await reply(
                    `_*Anti edit*_\n_Récupère les messages modifiés et affiche l'avant/après_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`.antiedit chat\` - envoie dans le chat original\n` +
                    `\`.antiedit sudo\` - envoie au propriétaire (sudo)\n` +
                    `\`.antiedit <jid>\` - envoie à un numéro/groupe spécifique\n` +
                    `\`.antiedit off\` - désactive l'anti-edit`
                );
            }

            if (target === 'off') {
                await db.setVar('ANTI_EDIT', 'off');
                await db.setVar('ANTI_EDIT_JID', '');
                return await reply(`_Anti-edit désactivé ❌_`);
            } else if (target === 'chat') {
                await db.setVar('ANTI_EDIT', 'chat');
                await db.setVar('ANTI_EDIT_JID', '');
                return await reply(`_Anti-edit activé ✅ (chat d'origine)_`);
            } else if (target === 'sudo') {
                await db.setVar('ANTI_EDIT', 'sudo');
                await db.setVar('ANTI_EDIT_JID', '');
                return await reply(`_Anti-edit activé ✅ (sudo)_`);
            } else if (target.includes('@')) {
                if (!target.match(/^\d+@(s\.whatsapp\.net|g\.us)$/)) {
                    return await reply(`_Format de numéro invalide !_`);
                }
                await db.setVar('ANTI_EDIT', 'custom');
                await db.setVar('ANTI_EDIT_JID', target);
                return await reply(`_Anti-edit activé ✅ (${target})_`);
            } else {
                return await reply(`_Option invalide. Tapez \`.antiedit\` pour voir l'aide._`);
            }
        }
    },
    {
        name: 'antilink',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const target = q.toLowerCase().trim();
            if (!target) {
                const current = await db.getVar('ANTI_LINK', 'off');
                return await reply(`_*Anti-Link*_\n_Supprime automatiquement les liens dans les groupes_\n\n_Statut actuel : ${current}_\n\n\`.antilink on\` — activer\n\`.antilink off\` — désactiver`);
            }
            if (target === 'on' || target === 'off') {
                await db.setVar('ANTI_LINK', target);
                return await reply(`_Anti-link ${target === 'on' ? 'activé ✅' : 'désactivé ❌'}_`);
            }
            return await reply(`_Option invalide : \`on\` ou \`off\`_`);
        }
    },
    {
        name: 'blacklist',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const args = q.trim().split(' ');
            const action = args[0]?.toLowerCase();
            const word = args.slice(1).join(' ').toLowerCase();

            if (action === 'add' && word) {
                await db.addBlacklistWord(word);
                return await reply(`_✅ Le mot "${word}" a été ajouté à la blacklist._`);
            } else if (action === 'remove' && word) {
                await db.removeBlacklistWord(word);
                return await reply(`_✅ Le mot "${word}" a été retiré de la blacklist._`);
            } else if (action === 'list') {
                const words = await db.getBlacklistWords();
                if (words.length === 0) return await reply(`_La blacklist est vide._`);
                return await reply(`_*Mots Interdits :*_\n${words.map(w => `- ${w}`).join('\n')}`);
            } else {
                return await reply(`_Utilisation :_\n\`.blacklist add <mot>\`\n\`.blacklist remove <mot>\`\n\`.blacklist list\``);
            }
        }
    }
];
