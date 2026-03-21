const crypto = require('crypto');

module.exports = [
    // 26 à 50 - Developer & Text Tools (25 Commandes)
    { name: 'base64en', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔐 Base64: \n\`\`\`${Buffer.from(ctx.q).toString('base64')}\`\`\``) } },
    { name: 'base64de', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔓 Texte: \n\`\`\`${Buffer.from(ctx.q, 'base64').toString('utf8')}\`\`\``) } },
    { name: 'hexen', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔐 Hex: \n\`\`\`${Buffer.from(ctx.q).toString('hex')}\`\`\``) } },
    { name: 'hexde', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔓 Texte: \n\`\`\`${Buffer.from(ctx.q, 'hex').toString('utf8')}\`\`\``) } },
    { name: 'bin2txt', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); try { await ctx.reply(`🔓 Texte: \n\`\`\`${ctx.q.split(' ').map(bin => String.fromCharCode(parseInt(bin, 2))).join('')}\`\`\``) } catch(e){await ctx.reply('Erreur binaire')} } },
    { name: 'txt2bin', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔐 Binaire: \n\`\`\`${ctx.q.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ')}\`\`\``) } },
    { name: 'length', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`📏 Longueur: *${ctx.q.length}* caractères.`) } },
    { name: 'reverse', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔄 Inversé: \n${ctx.q.split('').reverse().join('')}`) } },
    { name: 'upper', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔺 Majuscules: \n${ctx.q.toUpperCase()}`) } },
    { name: 'lower', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔻 Minuscules: \n${ctx.q.toLowerCase()}`) } },
    { name: 'titlecase', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔠 Titre: \n${ctx.q.split(' ').map(w => w[0]?.toUpperCase() + w.substr(1).toLowerCase()).join(' ')}`) } },
    { name: 'urlen', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔗 URL Encode: \n\`\`\`${encodeURIComponent(ctx.q)}\`\`\``) } },
    { name: 'urlde', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔗 URL Decode: \n\`\`\`${decodeURIComponent(ctx.q)}\`\`\``) } },
    { name: 'md5', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔒 MD5: \n\`\`\`${crypto.createHash('md5').update(ctx.q).digest('hex')}\`\`\``) } },
    { name: 'sha1', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔒 SHA1: \n\`\`\`${crypto.createHash('sha1').update(ctx.q).digest('hex')}\`\`\``) } },
    { name: 'sha256', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`🔒 SHA256: \n\`\`\`${crypto.createHash('sha256').update(ctx.q).digest('hex')}\`\`\``) } },
    { name: 'uuidv4', execute: async(ctx) => { await ctx.reply(`🆔 UUIDv4 Généré :\n\`\`\`${crypto.randomUUID()}\`\`\``) } },
    { name: 'passgen', execute: async(ctx) => { const len = parseInt(ctx.q) || 12; await ctx.reply(`🔑 Mdp: \n\`\`\`${crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0, len)}\`\`\``) } },
    { name: 'randnum', execute: async(ctx) => { const args = ctx.q.split(' '); const min = parseInt(args[0])||0; const max = parseInt(args[1])||100; await ctx.reply(`🎲 Aléatoire (${min}-${max}) :\n*${Math.floor(Math.random()*(max-min+1))+min}*`) } },
    { name: 'colorgen', execute: async(ctx) => { const col = Math.floor(Math.random()*16777215).toString(16); await ctx.reply(`🎨 Couleur Générée : \n*#${col}*`) } },
    { name: 'wordcount', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); await ctx.reply(`📝 Mots: *${ctx.q.split(/ +/).length}*`) } },
    { name: 'vowelcount', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); const c = (ctx.q.match(/[aeiouyàáâéèêëìíîïòóôöùúûü]/gi) || []).length; await ctx.reply(`🔤 Voyelles: *${c}*`) } },
    { name: 'consonantcount', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); const c = (ctx.q.match(/[bcdfghjklmnpqrstvwxz]/gi) || []).length; await ctx.reply(`🔡 Consonnes: *${c}*`) } },
    { name: 'spacecount', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); const c = (ctx.q.match(/ /g) || []).length; await ctx.reply(`␣ Espaces: *${c}*`) } },
    { name: 'digitcount', execute: async(ctx) => { if(!ctx.q) return await ctx.reply('Texte manquant'); const c = (ctx.q.match(/\d/g) || []).length; await ctx.reply(`🔢 Chiffres: *${c}*`) } }
];
