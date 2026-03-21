const db = require('../db');

module.exports = [
    {
        name: 'config',
        desc: 'Affiche le panneau de contrôle global et les statistiques de configuration du bot.',
        usage: '.config',
        adminOnly: true,
        execute: async (ctx) => {
            const { reply } = ctx;
            const currentMode = await db.getVar('MODE', 'public');
            const antiDeleteMode = await db.getVar('ANTI_DELETE', 'chat');
            const antiEditMode = await db.getVar('ANTI_EDIT', 'chat');
            const autoStatusMode = await db.getVar('AUTO_STATUS', 'like');
            const antilink = await db.getVar('ANTI_LINK', 'off');
            const exceptionsList = await db.getExceptions();
            const blacklisted = await db.getBlacklistWords();
            const antiVvMode = await db.getVar('ANTI_VV', 'off');
            const autoReadMode = await db.getVar('AUTO_READ', 'off');

            let txt = `╔════════════════════════╗\n`;
            txt += `║ ⚙️ *PANNEAU DE CONFIGURATION* ⚙️ ║\n`;
            txt += `╚════════════════════════╝\n\n`;
            
            txt += `🟢 *MODE GLOBAL* : \`${currentMode.toUpperCase()}\`\n`;
            txt += `🛡️ *ANTI-LINK* : \`${antilink.toUpperCase()}\`\n`;
            txt += `👁️ *AUTO-STATUS* : \`${autoStatusMode.toUpperCase()}\`\n`;
            txt += `📥 *AUTO-READ* : \`${autoReadMode.toUpperCase()}\`\n`;
            txt += `🗑️ *ANTI-DELETE* : \`${antiDeleteMode.toUpperCase()}\`\n`;
            txt += `✏️ *ANTI-EDIT*   : \`${antiEditMode.toUpperCase()}\`\n`;
            txt += `👻 *ANTI-VV*     : \`${antiVvMode.toUpperCase()}\`\n\n`;
            
            txt += `📝 *MOTS BLACKLISTÉS (${blacklisted.length})* :\n`;
            txt += ` > \`${blacklisted.join(', ') || 'Aucun'}\`\n\n`;

            txt += `🛡️ *EXCEPTIONS ANTI-LINK/DELETE (${exceptionsList.length})* :\n`;
            if (exceptionsList.length > 0) {
                exceptionsList.forEach(e => txt += ` -> \`${e}\`\n`);
            } else {
                txt += ` > \`Aucun favori immunisé.\`\n`;
            }

            txt += `\n_Modifiez ces valeurs via les commandes individuelles._`;

            return await reply(txt);
        }
    },
    {
        name: 'eval',
        aliases: ['>'],
        desc: 'Exécute du code JavaScript brut et destructif directement sur le VPS de l\'hôte.',
        usage: '.eval <code>',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply, sock, msg } = ctx;
            if (!q) return await reply(`_⚠️ Fournis du code JS à évaluer._`);
            try {
                // Créer un environnement riche pour l'évaluation
                const evalCmd = `(async () => { ${q.includes('await') ? q : `return ${q}`} })()`;
                const result = await eval(evalCmd);
                const output = require('util').inspect(result, { depth: 2 });
                await reply(`*✅ Évaluation Réussie*\n\`\`\`javascript\n${output}\n\`\`\``);
            } catch (e) {
                await reply(`*❌ Échec de l'évaluation*\n\`\`\`javascript\n${e.stack}\n\`\`\``);
            }
        }
    },
    {
        name: 'setname',
        desc: 'Modifie officiellement le pseudo/nom public du compte WhatsApp hébergeant le bot.',
        usage: '.setname <nom>',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, sock, reply } = ctx;
            if (!q) return await reply(`_Texte manquant._`);
            try {
                await sock.updateProfileName(q);
                await reply(`_✅ Le nom exclusif du bot a été changé en : *${q}*_`);
            } catch (e) {
                await reply(`_❌ Erreur : ${e.message}_`);
            }
        }
    },
    {
        name: 'setbio',
        aliases: ['setstatus'],
        desc: 'Met à jour instantanément la petite phrase (Actu/Bio) sur le profil WhatsApp du bot.',
        usage: '.setbio <actu>',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, sock, reply } = ctx;
            if (!q) return await reply(`_Texte manquant._`);
            try {
                await sock.updateProfileStatus(q);
                await reply(`_✅ L'actu/bio a bien été modifiée en : *${q}*_`);
            } catch (e) {
                await reply(`_❌ Erreur : ${e.message}_`);
            }
        }
    },
    {
        name: 'setpp',
        desc: 'Remplace définitivement la photo de profil du robot par l\'image pointée.',
        usage: 'A répondre avec: .setpp',
        masterOnly: true,
        execute: async (ctx) => {
            const { sock, msg, reply, commandName } = ctx;
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const quotedMsg = context?.quotedMessage;
            let mediaMessage = quotedMsg?.imageMessage || msg.message?.imageMessage;

            if (!mediaMessage) {
                return await reply(`_⚠️ Réponds à ton image préférée avec la commande \`.${commandName}\` pour en faire ma photo de profil !_`);
            }

            try {
                const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
                const stream = await downloadContentFromMessage(mediaMessage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                
                await sock.updateProfilePicture(sock.user.id, buffer);
                await reply(`_✅ Magnifique ! Ma nouvelle photo de profil est en place._`);
            } catch (e) {
                await reply(`_❌ Erreur : L'image est peut-être trop lourde. (${e.message})_`);
            }
        }
    },
    {
        name: 'except',
        desc: 'Gère la liste VIP des numéros immunisés et insensibles à la modération automatique.',
        usage: '.except add/remove/list <jid>',
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
                let msgText = `*Liste des Exceptions :*\n\n`;
                exceptionsList.forEach(e => msgText += `- ${e}\n`);
                return await reply(msgText);
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
        desc: 'Configure la visualisation (et le like silencieux 💚) automatique des Statuts de vos contacts.',
        usage: '.autostatus like/view/off',
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
        desc: 'Vérouille complètement le bot en mode Private (réservé au proprio) ou Public.',
        usage: '.mode public/private',
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
        desc: 'Intercepte et récupère les messages text/media effacés en douce par vos contacts.',
        usage: '.antidelete chat/sudo/off',
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
        desc: 'Fouille la mémoire pour exposer l\'ancienne version d\'un message modifié en traitre.',
        usage: '.antiedit chat/sudo/off',
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
        desc: 'Bouclier paranoïaque : censure instantanément TOUS les liens suspects ou normaux.',
        usage: '.antilink on/off',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const target = q.toLowerCase().trim();
            if (!target) {
                const current = await db.getVar('ANTI_LINK', 'off');
                return await reply(`_*Anti-Link*_\n_Supprime automatiquement ABSOLUMENT tous les liens dans les groupes (tolérance zéro)_\n\n_Statut actuel : ${current}_\n\n\`.antilink on\` — activer\n\`.antilink off\` — désactiver`);
            }
            if (target === 'on' || target === 'off') {
                await db.setVar('ANTI_LINK', target);
                return await reply(`_Anti-link ${target === 'on' ? 'activé (Tolérance zéro) ✅' : 'désactivé ❌'}_`);
            }
            return await reply(`_Option invalide : \`on\` ou \`off\`_`);
        }
    },
    {
        name: 'blacklist',
        desc: 'Censure impitoyablement tout membre prononçant l\'un des mots interdits configurés.',
        usage: '.blacklist add/remove/list <mot>',
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
    },
    {
        name: 'setprefix',
        desc: 'Change le préfixe de déclenchement des commandes du bot (ex: . / ! / #). Effet immédiat, sans redémarrage.',
        usage: '.setprefix <nouveauPréfixe>',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const newPrefix = q.trim();
            if (!newPrefix || newPrefix.length > 3) {
                const current = await db.getVar('BOT_PREFIX', '.');
                return await reply(
                    `_*Changement de Préfixe*_\n` +
                    `_Préfixe actuel : \`${current}\`_\n\n` +
                    `_Utilisation :_\n` +
                    `\`.setprefix !\` → utiliser !\n` +
                    `\`.setprefix /\` → utiliser /\n` +
                    `\`.setprefix $\` → utiliser $\n\n` +
                    `_⚠️ Le préfixe doit faire 1 à 3 caractères max._`
                );
            }
            await db.setVar('BOT_PREFIX', newPrefix);
            await reply(`_✅ Préfixe changé en : *${newPrefix}*_\n_Utilisation immédiate : \`${newPrefix}help\`_`);
        }
    },
    {
        name: 'autoread',
        desc: 'Simule votre présence humaine en envoyant systématiquement des coches bleues (lu).',
        usage: '.autoread on/off',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const target = q.toLowerCase().trim();
            if (target === 'on' || target === 'off') {
                await db.setVar('AUTO_READ', target);
                return await reply(`_✅ Auto-Read (Lecture automatique des messages) ${target === 'on' ? 'ACTIVÉ' : 'DÉSACTIVÉ'}._`);
            }
            const current = await db.getVar('AUTO_READ', 'off');
            return await reply(`_*Auto Read*_\n_Statut: ${current}_\n\`.autoread on/off\``);
        }
    },
    {
        name: 'antivv',
        desc: 'Arme de destruction de la vie privée: enregistre clandestinement toutes les "Vues Uniques".',
        usage: '.antivv sudo/chat/off',
        adminOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const target = q.toLowerCase().trim();
            const currentStatus = await db.getVar('ANTI_VV', 'off');

            if (!target) {
                return await reply(
                    `_*Anti Vue-Unique*_\n_Récupère les photos/vidéos/audios éphémères_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`.antivv chat\` - renvoie dans le chat original\n` +
                    `\`.antivv sudo\` - envoie au propriétaire en privé\n` +
                    `\`.antivv off\` - désactive la fonctionnalité`
                );
            }

            if (target === 'off') {
                await db.setVar('ANTI_VV', 'off');
                return await reply(`_Anti-VV désactivé ❌_`);
            } else if (target === 'chat') {
                await db.setVar('ANTI_VV', 'chat');
                return await reply(`_Anti-VV activé ✅ (chat d'origine)_`);
            } else if (target === 'sudo') {
                await db.setVar('ANTI_VV', 'sudo');
                return await reply(`_Anti-VV activé ✅ (sudo - MP)_`);
            } else {
                return await reply(`_Option invalide._`);
            }
        }
    }
];
