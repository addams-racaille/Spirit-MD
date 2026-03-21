const os = require('os');

module.exports = [
    // 76 à 100 - Information & Random Data (25 Commandes)
    { name: 'whoami', execute: async(ctx) => { await ctx.reply(`👤 *VOTRE PROFIL*\n\nNom: ${ctx.pushName}\nID: \`${ctx.from.split('@')[0]}\``) } },
    { name: 'serverinfo', execute: async(ctx) => { await ctx.reply(`🖥️ *SERVEUR*\n\nOS: ${os.type()} ${os.arch()}\nLoad: ${os.loadavg()[0]}\nSession: ${ctx.sessionId}`) } },
    { name: 'now', execute: async(ctx) => { await ctx.reply(`🕒 *HEURE LOCALE*\n\n${new Date().toLocaleString('fr-FR')}`) } },
    { name: 'timestamp', execute: async(ctx) => { await ctx.reply(`⏳ *TIMESTAMP*\n\n\`${Date.now()}\``) } },
    { name: 'uptimevps', execute: async(ctx) => { await ctx.reply(`⚙️ *UPTIME SYSTÈME*\n\n${(os.uptime()/3600).toFixed(2)} Heures`) } },
    { name: 'uptimebot', execute: async(ctx) => { await ctx.reply(`🤖 *UPTIME BOT*\n\n${(process.uptime()/3600).toFixed(2)} Heures`) } },
    { name: 'version', execute: async(ctx) => { await ctx.reply(`🏷️ *VERSION*\n\nBot: v2.0-SaaS\nNode: ${process.version}`) } },
    { name: 'owner', execute: async(ctx) => { 
        const o = ctx.sock.customOwner || 'Aucun (Public)';
        await ctx.reply(`👑 *PROPRIÉTAIRE DE L'INSTANCE*\n\nID: \`${o}\``) 
    }},
    { name: 'groupid', groupOnly: true, execute: async(ctx) => { await ctx.reply(`🆔 *JID DU GROUPE*\n\n\`${ctx.from}\``) } },
    { name: 'myid', execute: async(ctx) => { 
        const sender = ctx.msg.key.participant || ctx.from;
        await ctx.reply(`🆔 *VOTRE JID*\n\n\`${sender}\``) 
    }},
    { name: 'randletter', execute: async(ctx) => { 
        const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; 
        await ctx.reply(`🔤 Lettre aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randword', execute: async(ctx) => {
        const w = ['Bouteille','Clavier','Ordinature','Maison','Voiture','Ciel','Guitare','Océan','Lumière','Ombre'];
        await ctx.reply(`📝 Mot aléatoire : *${w[Math.floor(Math.random()*w.length)]}*`) 
    }},
    { name: 'randcountry', execute: async(ctx) => {
        const c = ['France','Japon','Brésil','Canada','Sénégal','Mali','Burkina Faso','USA','Vietnam','Chine'];
        await ctx.reply(`🌍 Pays aléatoire : *${c[Math.floor(Math.random()*c.length)]}*`) 
    }},
    { name: 'randcapital', execute: async(ctx) => {
        const c = ['Paris','Tokyo','Brasilia','Ottawa','Dakar','Bamako','Ouagadougou','Washington','Hanoï','Pékin'];
        await ctx.reply(`🏛️ Capitale aléatoire : *${c[Math.floor(Math.random()*c.length)]}*`) 
    }},
    { name: 'randanimal', execute: async(ctx) => {
        const a = ['Lion','Tigre','Étalon','Aigle','Baleine','Léopard','Serpent','Ours','Loup','Crocodile'];
        await ctx.reply(`🦁 Animal aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randfruit', execute: async(ctx) => {
        const a = ['Pomme','Poire','Banane','Fraise','Kiwi','Mangue','Ananas','Grenade','Pastèque','Clémentine'];
        await ctx.reply(`🍎 Fruit aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randcolor', execute: async(ctx) => {
        const a = ['Rouge','Bleu','Vert','Jaune','Violet','Orange','Cyan','Magenta','Noir','Blanc'];
        await ctx.reply(`🎨 Couleur aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randplanet', execute: async(ctx) => {
        const a = ['Mercure','Vénus','Terre','Mars','Jupiter','Saturne','Uranus','Neptune','Pluton (Dans nos coeurs)'];
        await ctx.reply(`🪐 Planète aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randelement', execute: async(ctx) => {
        const a = ['Hydrogène','Hélium','Lithium','Béryllium','Bore','Carbone','Azote','Oxygène','Fluor','Néon'];
        await ctx.reply(`🧪 Élément aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'randemotion', execute: async(ctx) => {
        const a = ['Joie','Tristesse','Colère','Peur','Dégoût','Surprise','Anticipation','Confiance'];
        await ctx.reply(`🎭 Émotion aléatoire : *${a[Math.floor(Math.random()*a.length)]}*`) 
    }},
    { name: 'botname', execute: async(ctx) => { await ctx.reply(`🤖 *NOM DU BOT*\n\nJe m'appelle *Spirit-MD* !`) } },
    { name: 'developer', execute: async(ctx) => { await ctx.reply(`👨‍💻 *DÉVELOPPEUR*\n\nCréé avec passion par *Ouédraogo Fabrice* et l'Intelligence Artificielle.`) } },
    { name: 'host', execute: async(ctx) => { await ctx.reply(`☁️ *HÉBERGEMENT*\n\nHébergé sur un VPS ultra-performant en architecture SaaS.`) } },
    { name: 'features', execute: async(ctx) => { await ctx.reply(`✨ *FONCTIONNALITÉS*\n\nPlus de 150 commandes actives, Anti-Delete, Anti-Link radical, et téléchargement médias universel !`) } },
    { name: 'totalcommands', execute: async(ctx) => { 
        const commandHandler = require('../handlers/commandHandler');
        const map = commandHandler.getCommandsMap();
        await ctx.reply(`📈 *STATISTIQUES DE COMMANDES*\n\nLe bot possède exactement *${map.size}* commandes définies en mémoire !`) 
    }}
];
