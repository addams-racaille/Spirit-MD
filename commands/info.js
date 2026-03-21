const os = require('os');

module.exports = [
    { name: 'whoami', desc: 'Récupère et affiche de manière précise ton ID WhatsApp technique enregistré.', usage: '.whoami', execute: async(ctx) => { await ctx.reply(`👤 *VOTRE PROFIL*\n\nNom: ${ctx.pushName}\nID: \`${ctx.from.split('@')[0]}\``) } },
    { name: 'serverinfo', desc: 'Sors un audit d\'informations basiques du VPS (Machine OS / Serveur Hôte).', usage: '.serverinfo', execute: async(ctx) => { await ctx.reply(`🖥️ *SERVEUR*\n\nOS: ${os.type()} ${os.arch()}\nLoad: ${os.loadavg()[0]}\nSession: ${ctx.sessionId}`) } },
    { name: 'now', desc: 'Affiche en clair l\'horloge interne exacte du serveur d\'hébergement (Heure).', usage: '.now', execute: async(ctx) => { await ctx.reply(`🕒 *HEURE LOCALE*\n\n${new Date().toLocaleString('fr-FR')}`) } },
    { name: 'timestamp', desc: 'Converti le moment actuel en format chronologique universel Epoch (Unix).', usage: '.timestamp', execute: async(ctx) => { await ctx.reply(`⏳ *TIMESTAMP*\n\n\`${Date.now()}\``) } },
    { name: 'uptimevps', desc: 'Examine en direct le temps total d\'allumage ininterrompu de ton Serveur.', usage: '.uptimevps', execute: async(ctx) => { await ctx.reply(`⚙️ *UPTIME SYSTÈME*\n\n${(os.uptime()/3600).toFixed(2)} Heures`) } },
    { name: 'uptimebot', desc: 'Chronomètre depuis combien de ms/s le processus de ton Bot est éveillé.', usage: '.uptimebot', execute: async(ctx) => { await ctx.reply(`🤖 *UPTIME BOT*\n\n${(process.uptime()/3600).toFixed(2)} Heures`) } },
    { name: 'version', desc: 'Indique avec exactitude les versions moteur (Bot, Node) de ce programme.', usage: '.version', execute: async(ctx) => { await ctx.reply(`🏷️ *VERSION*\n\nBot: v2.0-SaaS\nNode: ${process.version}`) } },
    { name: 'owner', desc: 'Trouve l\'identité et l\'identifiant chiffré brut du dirigeant en charge.', usage: '.owner', execute: async(ctx) => { 
        const o = ctx.sock.customOwner || 'Aucun (Public)';
        await ctx.reply(`👑 *PROPRIÉTAIRE DE L'INSTANCE*\n\nID: \`${o}\``) 
    }},
    { name: 'groupid', groupOnly: true, desc: 'Affiche en clair le code matriciel caché/ID JID de ton canal/groupe commun.', usage: '.groupid', execute: async(ctx) => { await ctx.reply(`🆔 *JID DU GROUPE*\n\n\`${ctx.from}\``) } },
    { name: 'myid', desc: 'Vous envoie la chaîne compliquée du JID @s.whatsapp.net personnel.', usage: '.myid', execute: async(ctx) => { 
        const sender = ctx.msg.key.participant || ctx.from;
        await ctx.reply(`🆔 *VOTRE JID*\n\n\`${sender}\``) 
    }},
    { name: 'randletter', desc: 'Pioche au hasard total une lettre isolée de l\'alphabète de 26 lettres.', usage: '.randletter', execute: async(ctx) => { 
        const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; 
        await ctx.reply(`🔤 Lettre aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randword', desc: 'Tire à l\'aveugle un mot dictionnaire usuel pour t\'inspirer vaguement.', usage: '.randword', execute: async(ctx) => {
        const w = ['Bouteille','Clavier','Ordinature','Maison','Voiture','Ciel','Guitare','Océan','Lumière','Ombre'];
        await ctx.reply(`📝 Mot aléatoire : *${w[Math.floor(Math.random()*w.length)]}*`) 
    }},
    { name: 'randcountry', desc: 'Affiche magiquement un des pays souverains localisés sur notre sphère.', usage: '.randcountry', execute: async(ctx) => {
        const c = ['France','Japon','Brésil','Canada','Sénégal','Mali','Burkina Faso','USA','Vietnam','Chine'];
        await ctx.reply(`🌍 Pays aléatoire : *${c[Math.floor(Math.random()*c.length)]}*`) 
    }},
    { name: 'randcapital', desc: 'Apprend-toi la géographie via le tirage hasardeux d\'une métropole politique.', usage: '.randcapital', execute: async(ctx) => {
        const c = ['Paris','Tokyo','Brasilia','Ottawa','Dakar','Bamako','Ouagadougou','Washington','Hanoï','Pékin'];
        await ctx.reply(`🏛️ Capitale aléatoire : *${c[Math.floor(Math.random()*c.length)]}*`) 
    }},
    { name: 'randanimal', desc: 'Enumère une bête de la jungle (ou autre) via le système interne du bot.', usage: '.randanimal', execute: async(ctx) => {
        const a = ['Lion','Tigre','Étalon','Aigle','Baleine','Léopard','Serpent','Ours','Loup','Crocodile'];
        await ctx.reply(`🦁 Animal aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randfruit', desc: 'Obtenez une recommandation diététique via un tirage au sort de fruit.', usage: '.randfruit', execute: async(ctx) => {
        const a = ['Pomme','Poire','Banane','Fraise','Kiwi','Mangue','Ananas','Grenade','Pastèque','Clémentine'];
        await ctx.reply(`🍎 Fruit aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randcolor', desc: 'Propose à ton esprit visuel un nom de couleur standard pré-stockée.', usage: '.randcolor', execute: async(ctx) => {
        const a = ['Rouge','Bleu','Vert','Jaune','Violet','Orange','Cyan','Magenta','Noir','Blanc'];
        await ctx.reply(`🎨 Couleur aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randplanet', desc: 'Propose le nom majestueux d\'un corps céleste majeur de la galaxie.', usage: '.randplanet', execute: async(ctx) => {
        const a = ['Mercure','Vénus','Terre','Mars','Jupiter','Saturne','Uranus','Neptune','Pluton (Dans nos coeurs)'];
        await ctx.reply(`🪐 Planète aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randelement', desc: 'Vomira un des éléments essentiels de la table de Mendeleïev.', usage: '.randelement', execute: async(ctx) => {
        const a = ['Hydrogène','Hélium','Lithium','Béryllium','Bore','Carbone','Azote','Oxygène','Fluor','Néon'];
        await ctx.reply(`🧪 Élément aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randemotion', desc: 'Déterminera mystiquement une émotion de tous les jours au pifomètre.', usage: '.randemotion', execute: async(ctx) => {
        const a = ['Joie','Tristesse','Colère','Peur','Dégoût','Surprise','Anticipation','Confiance'];
        await ctx.reply(`🎭 Émotion aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'botname', desc: 'Interpelle officiellement la mémoire pour vérifier le nom du logiciel.', usage: '.botname', execute: async(ctx) => { await ctx.reply(`🤖 *NOM DU BOT*\n\nJe m'appelle *Spirit-MD* !`) } },
    { name: 'developer', desc: 'Affiche une page de crédits soulignant la gloire des créateurs.', usage: '.developer', execute: async(ctx) => { await ctx.reply(`👨‍💻 *DÉVELOPPEUR*\n\nCréé avec passion par *Ouédraogo Fabrice* et l'Intelligence Artificielle.`) } },
    { name: 'host', desc: 'Fournit la description laconique du service assurant ce bot WhatsApp.', usage: '.host', execute: async(ctx) => { await ctx.reply(`☁️ *HÉBERGEMENT*\n\nHébergé sur un VPS ultra-performant en architecture SaaS.`) } },
    { name: 'features', desc: 'Récapitule le nombre massif d\'avantages inclus dans cette version.', usage: '.features', execute: async(ctx) => { await ctx.reply(`✨ *FONCTIONNALITÉS*\n\nPlus de 150 commandes actives, Anti-Delete, Anti-Link radical, et téléchargement médias universel !`) } },
    { name: 'totalcommands', desc: 'Analyse et compte toutes les commandes listées prêtes à l\'usage.', usage: '.totalcommands', execute: async(ctx) => { 
        const commandHandler = require('../handlers/commandHandler');
        const map = commandHandler.getCommandsMap ? commandHandler.getCommandsMap() : commandHandler.commands;
        await ctx.reply(`📈 *STATISTIQUES DE COMMANDES*\n\nLe bot possède exactement *${map.size}* commandes définies en mémoire !`);
    }}
];
