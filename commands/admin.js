const db = require('../db');

module.exports = [
    {
        name: 'config',
        desc: 'Affiche le panneau de contrôle global et les statistiques de configuration du bot.',
        usage: '.config',
        ownerOnly: true,
        execute: async (ctx) => {
            const { reply } = ctx;
            const currentMode = await ctx.getVar('MODE', 'public');
            const antiDeleteMode = await ctx.getVar('ANTI_DELETE', 'chat');
            const antiEditMode = await ctx.getVar('ANTI_EDIT', 'chat');
            const autoStatusMode = await ctx.getVar('AUTO_STATUS', 'like');
            const antilink = await ctx.getVar('ANTI_LINK', 'off');
            const exceptionsList = await ctx.getExceptions();
            const blacklisted = await ctx.getBlacklistWords();
            const antiVvMode = await ctx.getVar('ANTI_VV', 'off');
            const autoReadMode = await ctx.getVar('AUTO_READ', 'off');

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
        ownerOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const args = q.trim().split(/ +/);
            const action = args[0]?.toLowerCase();
            const target = args[1];

            if (!action || (action !== 'list' && !target)) {
                const p = ctx.currentPrefix || '.';
                return await reply(
                    `_*Exceptions Manager*_\n_Ignore l'Anti-Delete et l'Anti-Edit pour certains chats_\n\n` +
                    `_Utilisation :_\n` +
                    `\`${p}except add <jid>\` - Ajouter une exception\n` +
                    `\`${p}except remove <jid>\` - Retirer une exception\n` +
                    `\`${p}except list\` - Voir les exceptions\n\n` +
                    `_Exemples de JID :_\n` +
                    `- Utilisateur : \`123456789@s.whatsapp.net\`\n` +
                    `- Groupe : \`123456-789@g.us\``
                );
            }

            if (action === 'list') {
                const exceptionsList = await ctx.getExceptions();
                if (exceptionsList.length === 0) return await reply(`_Aucune exception configurée._`);
                let msgText = `*Liste des Exceptions :*\n\n`;
                exceptionsList.forEach(e => msgText += `- ${e}\n`);
                return await reply(msgText);
            }

            if (!target.includes('@')) {
                return await reply(`_Format invalide. L'ID doit contenir @s.whatsapp.net ou @g.us_`);
            }

            if (action === 'add') {
                await ctx.addException(target);
                return await reply(`_✅ Ajouté aux exceptions : ${target}_`);
            } else if (action === 'remove') {
                await ctx.removeException(target);
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
        ownerOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            let target = q.toLowerCase().trim();
            const currentStatus = await ctx.getVar('AUTO_STATUS', 'like');

            if (!target) {
                const p = ctx.currentPrefix || '.';
                return await reply(
                    `_*Auto Status*_\n_G\u00e8re la lecture de statuts WhatsApp_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`${p}autostatus like\` - lit et like (\uD83D\uDC9A) automatiquement\n` +
                    `\`${p}autostatus view\` - lit sans r\u00e9agir\n` +
                    `\`${p}autostatus off\` - d\u00e9sactive la fonctionnalit\u00e9`
                );
            }

            if (['like', 'view', 'off'].includes(target)) {
                await ctx.setVar('AUTO_STATUS', target);
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
        ownerOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const newMode = q.toLowerCase().trim();
            if (newMode === 'public' || newMode === 'private') {
                await ctx.setVar('MODE', newMode);
                return await reply(`_✅ Le mode du bot a été défini sur : *${newMode}*_`);
            } else {
                const currentMode = await ctx.getVar('MODE', 'public');
                const p = ctx.currentPrefix || '.';
                return await reply(`_*Mode manager*_\n_Mode actuel : ${currentMode}_\n_Utilisation : \`${p}mode public|private\`_`);
            }
        }
    },
    {
        name: 'antidelete',
        desc: 'Intercepte et récupère les messages text/media effacés en douce par vos contacts.',
        usage: '.antidelete chat/sudo/off',
        ownerOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            let target = q.toLowerCase().trim();
            const currentStatus = await ctx.getVar('ANTI_DELETE', 'chat');

            if (!target) {
                const p = ctx.currentPrefix || '.';
                return await reply(
                    `_*Anti delete*_\n_R\u00e9cup\u00e8re les messages supprim\u00e9s et les renvoie_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`${p}antidelete chat\` - envoie dans le chat original\n` +
                    `\`${p}antidelete sudo\` - envoie au propri\u00e9taire (sudo)\n` +
                    `\`${p}antidelete <jid>\` - envoie \u00e0 un num\u00e9ro/groupe sp\u00e9cifique\n` +
                    `\`${p}antidelete off\` - d\u00e9sactive l'anti-delete`
                );
            }

            if (target === 'off') {
                await ctx.setVar('ANTI_DELETE', 'off');
                await ctx.setVar('ANTI_DELETE_JID', '');
                return await reply(`_Anti-delete désactivé ❌_`);
            } else if (target === 'chat') {
                await ctx.setVar('ANTI_DELETE', 'chat');
                await ctx.setVar('ANTI_DELETE_JID', '');
                return await reply(`_Anti-delete activé ✅ (chat d'origine)_`);
            } else if (target === 'sudo') {
                await ctx.setVar('ANTI_DELETE', 'sudo');
                await ctx.setVar('ANTI_DELETE_JID', '');
                return await reply(`_Anti-delete activé ✅ (sudo)_`);
            } else if (target.includes('@')) {
                if (!target.match(/^\d+@(s\.whatsapp\.net|g\.us)$/)) {
                    return await reply(`_Format de numéro invalide !_`);
                }
                await ctx.setVar('ANTI_DELETE', 'custom');
                await ctx.setVar('ANTI_DELETE_JID', target);
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
        ownerOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            let target = q.toLowerCase().trim();
            const currentStatus = await ctx.getVar('ANTI_EDIT', 'chat');

            if (!target) {
                const p = ctx.currentPrefix || '.';
                return await reply(
                    `_*Anti edit*_\n_R\u00e9cup\u00e8re les messages modifi\u00e9s et affiche l'avant/apr\u00e8s_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`${p}antiedit chat\` - envoie dans le chat original\n` +
                    `\`${p}antiedit sudo\` - envoie au propri\u00e9taire (sudo)\n` +
                    `\`${p}antiedit <jid>\` - envoie \u00e0 un num\u00e9ro/groupe sp\u00e9cifique\n` +
                    `\`${p}antiedit off\` - d\u00e9sactive l'anti-edit`
                );
            }

            if (target === 'off') {
                await ctx.setVar('ANTI_EDIT', 'off');
                await ctx.setVar('ANTI_EDIT_JID', '');
                return await reply(`_Anti-edit désactivé ❌_`);
            } else if (target === 'chat') {
                await ctx.setVar('ANTI_EDIT', 'chat');
                await ctx.setVar('ANTI_EDIT_JID', '');
                return await reply(`_Anti-edit activé ✅ (chat d'origine)_`);
            } else if (target === 'sudo') {
                await ctx.setVar('ANTI_EDIT', 'sudo');
                await ctx.setVar('ANTI_EDIT_JID', '');
                return await reply(`_Anti-edit activé ✅ (sudo)_`);
            } else if (target.includes('@')) {
                if (!target.match(/^\d+@(s\.whatsapp\.net|g\.us)$/)) {
                    return await reply(`_Format de numéro invalide !_`);
                }
                await ctx.setVar('ANTI_EDIT', 'custom');
                await ctx.setVar('ANTI_EDIT_JID', target);
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
        ownerOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const target = q.toLowerCase().trim();
            if (!target) {
                const current = await ctx.getVar('ANTI_LINK', 'off');
                const p = ctx.currentPrefix || '.';
                return await reply(`_*Anti-Link*_\n_Supprime automatiquement ABSOLUMENT tous les liens dans les groupes (tol\u00e9rance z\u00e9ro)_\n\n_Statut actuel : ${current}_\n\n\`${p}antilink on\` \u2014 activer\n\`${p}antilink off\` \u2014 d\u00e9sactiver`);
            }
            if (target === 'on' || target === 'off') {
                await ctx.setVar('ANTI_LINK', target);
                return await reply(`_Anti-link ${target === 'on' ? 'activé (Tolérance zéro) ✅' : 'désactivé ❌'}_`);
            }
            return await reply(`_Option invalide : \`on\` ou \`off\`_`);
        }
    },
    {
        name: 'blacklist',
        desc: 'Censure impitoyablement tout membre prononçant l\'un des mots interdits configurés.',
        usage: '.blacklist add/remove/list <mot>',
        ownerOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const args = q.trim().split(' ');
            const action = args[0]?.toLowerCase();
            const word = args.slice(1).join(' ').toLowerCase();

            if (action === 'add' && word) {
                await ctx.addBlacklistWord(word);
                return await reply(`_✅ Le mot "${word}" a été ajouté à la blacklist._`);
            } else if (action === 'remove' && word) {
                await ctx.removeBlacklistWord(word);
                return await reply(`_✅ Le mot "${word}" a été retiré de la blacklist._`);
            } else if (action === 'list') {
                const words = await ctx.getBlacklistWords();
                if (words.length === 0) return await reply(`_La blacklist est vide._`);
                return await reply(`_*Mots Interdits :*_\n${words.map(w => `- ${w}`).join('\n')}`);
            } else {
                const p = ctx.currentPrefix || '.';
                return await reply(`_Utilisation :_\n\`${p}blacklist add <mot>\`\n\`${p}blacklist remove <mot>\`\n\`${p}blacklist list\``);
            }
        }
    },
    {
        name: 'setprefix',
        aliases: ['prefix', 'setprefixe'],
        desc: 'Change le préfixe de déclenchement des commandes du bot (ex: . / ! / #). Effet immédiat, sans redémarrage.',
        usage: '.setprefix <nouveauPréfixe>',
        ownerOnly: true,
        execute: async (ctx) => {
            const { q, reply, sessionId, currentPrefix } = ctx;
            const newPrefix = q.trim();
            if (!newPrefix || newPrefix.length > 3) {
                return await reply(
                    `_*Changement de Préfixe*_\n` +
                    `_Préfixe actuel de cette instance : \`${currentPrefix}\`_\n\n` +
                    `_Utilisation :_\n` +
                    `\`${currentPrefix}setprefix !\` → utiliser !\n` +
                    `\`${currentPrefix}setprefix /\` → utiliser /\n` +
                    `\`${currentPrefix}setprefix $\` → utiliser $\n\n` +
                    `_⚠️ Le préfixe doit faire 1 à 3 caractères max._`
                );
            }
            // Sauvegarde avec clef unique par instance (BOT_PREFIX_<sessionId>)
            const sessionPrefixKey = `BOT_PREFIX_${sessionId}`;
            await ctx.setVar(sessionPrefixKey, newPrefix);
            await reply(`_✅ Préfixe de cette instance changé en : *${newPrefix}*_\n_Utilisation immédiate : \`${newPrefix}help\`_`);
        }
    },
    {
        name: 'autoread',
        desc: 'Simule votre présence humaine en envoyant systématiquement des coches bleues (lu).',
        usage: '.autoread on/off',
        ownerOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const target = q.toLowerCase().trim();
            if (target === 'on' || target === 'off') {
                await ctx.setVar('AUTO_READ', target);
                return await reply(`_✅ Auto-Read (Lecture automatique des messages) ${target === 'on' ? 'ACTIVÉ' : 'DÉSACTIVÉ'}._`);
            }
            const current = await ctx.getVar('AUTO_READ', 'off');
            const p = ctx.currentPrefix || '.';
            return await reply(`_*Auto Read*_\n_Statut: ${current}_\n\`${p}autoread on/off\``);
        }
    },
    {
        name: 'antivv',
        desc: 'Arme de destruction de la vie privée: enregistre clandestinement toutes les "Vues Uniques".',
        usage: '.antivv sudo/chat/off',
        ownerOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const target = q.toLowerCase().trim();
            const currentStatus = await ctx.getVar('ANTI_VV', 'off');

            if (!target) {
                const p = ctx.currentPrefix || '.';
                return await reply(
                    `_*Anti Vue-Unique*_\n_R\u00e9cup\u00e8re les photos/vid\u00e9os/audios \u00e9ph\u00e9m\u00e8res_\n\n` +
                    `_Statut actuel : ${currentStatus}_\n\n_Utilisation :_\n` +
                    `\`${p}antivv chat\` - renvoie dans le chat original\n` +
                    `\`${p}antivv sudo\` - envoie au propri\u00e9taire en priv\u00e9\n` +
                    `\`${p}antivv off\` - d\u00e9sactive la fonctionnalit\u00e9`
                );
            }

            if (target === 'off') {
                await ctx.setVar('ANTI_VV', 'off');
                return await reply(`_Anti-VV désactivé ❌_`);
            } else if (target === 'chat') {
                await ctx.setVar('ANTI_VV', 'chat');
                return await reply(`_Anti-VV activé ✅ (chat d'origine)_`);
            } else if (target === 'sudo') {
                await ctx.setVar('ANTI_VV', 'sudo');
                return await reply(`_Anti-VV activé ✅ (sudo - MP)_`);
            } else {
                return await reply(`_Option invalide._`);
            }
        }
    },
    {
        name: 'logs',
        desc: 'Récupère et affiche les dernières lignes de journal du bot sur le serveur VPS.',
        usage: '.logs [out|err]',
        masterOnly: true,
        execute: async (ctx) => {
            const { q, reply } = ctx;
            const type = q.toLowerCase().trim() === 'err' ? 'err' : 'out';
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(__dirname, '../logs', `${type}.log`);
            
            if (!fs.existsSync(logPath)) return await reply(`_Le fichier de logs ${type}.log est introuvable sur le serveur._`);

            try {
                const logContent = fs.readFileSync(logPath, 'utf8');
                let lines = logContent.split('\n').filter(l => l.trim() !== '');
                // On garde les 40 dernières lignes
                let lastLines = lines.slice(-40).join('\n');
                
                // Truncate à 4000 caractères au cas où pour passer sur WhatsApp sans erreur
                if (lastLines.length > 4000) lastLines = "..." + lastLines.substring(lastLines.length - 4000);
                
                await reply(`*📄 LOGS SYSTÈME (${type.toUpperCase()})*\n_Dernières activités :_\n\n\`\`\`\n${lastLines || 'Aucun log enregistré pour le moment.'}\n\`\`\``);
            } catch (e) {
                await reply(`_❌ Impossible de lire les logs : ${e.message}_`);
            }
        }
    }
];
