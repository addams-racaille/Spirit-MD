module.exports = [
    // 51 à 75 - Mini-Games & Economy Lite (25 Commandes)
    { name: 'slots', execute: async(ctx) => { 
        const e = ['🍒','🍋','🍊','🍇','🔔','💎','💰']; 
        const res = [e[Math.floor(Math.random()*e.length)], e[Math.floor(Math.random()*e.length)], e[Math.floor(Math.random()*e.length)]];
        await ctx.reply(`🎰 *SLOTS* 🎰\n\n[ ${res.join(' | ')} ]\n\n${(res[0]===res[1] && res[1]===res[2]) ? 'JACKPOT !! 🏆🎊' : 'Perdu... 💸'}`);
    }},
    { name: 'russianroulette', aliases: ['rr'], execute: async(ctx) => { 
        const bullet = Math.floor(Math.random() * 6);
        const pull = Math.floor(Math.random() * 6);
        await ctx.reply(`🔫 *Roulette Russe*\n\n_Tu presses la détente..._\n\n${bullet === pull ? '💥 BANNNNG ! T\'es mort !' : '💨 Clic. Ouf, survivant !'}`);
    }},
    { name: 'hunt', execute: async(ctx) => {
        const a = ['un lapin 🐇','un cerf 🦌','un sanglier 🦌','un ours 🐗','rien du tout 🍂','un dragon 🐉 (!?)'];
        await ctx.reply(`🏹 *@${ctx.pushName}* part chasser dans la forêt...\n\nEt ramène *${a[Math.floor(Math.random()*a.length)]}* !`);
    }},
    { name: 'fish', execute: async(ctx) => {
        const a = ['un saumon 🐟','une vieille botte 👢','un requin 🦈','un poisson rouge 🐡','un trésor 💰','rien 🌊'];
        await ctx.reply(`🎣 *@${ctx.pushName}* lance sa ligne...\n\nEt pêche *${a[Math.floor(Math.random()*a.length)]}* !`);
    }},
    { name: 'mine', execute: async(ctx) => {
        const a = ['du charbon 🪨','du fer ⛏️','de l\'or 🥇','du diamant 💎','de l\'émeraude ❇️','de la terre 🟤'];
        await ctx.reply(`⛏️ *@${ctx.pushName}* creuse profondément...\n\nEt trouve *${a[Math.floor(Math.random()*a.length)]}* !`);
    }},
    { name: 'chop', execute: async(ctx) => {
        const a = ['du bois de chêne 🪵','du bois de bouleau 🪵','du bois sombre 🪵','une pomme 🍎','une branche 🌿'];
        await ctx.reply(`🪓 *@${ctx.pushName}* abat un arbre...\n\nEt obtient *${a[Math.floor(Math.random()*a.length)]}* !`);
    }},
    { name: 'rob', execute: async(ctx) => {
        const s = Math.random() > 0.5;
        const target = ctx.args[0] || 'la banque';
        await ctx.reply(`🥷 *@${ctx.pushName}* tente de braquer *${target}*...\n\n${s ? '💰 Braquage RÉUSSI !! Tu t\'enfuis avec le butin !' : '🚨 ALARME !! Tu te fais arrêter par la police !'}`);
    }},
    { name: 'work', execute: async(ctx) => {
        const j = ['Éboueur','Développeur','Streamer','Chauffeur','Médecin','Cuisinier'];
        const e = Math.floor(Math.random() * 500) + 50;
        await ctx.reply(`💼 *@${ctx.pushName}* a travaillé comme *${j[Math.floor(Math.random()*j.length)]}* et a gagné *${e} $* !`);
    }},
    { name: 'crime', execute: async(ctx) => {
        const s = Math.random() > 0.6;
        await ctx.reply(`🔫 *@${ctx.pushName}* commet un crime...\n\n${s ? '💰 Succès ! Tu gagnes gros !' : '🚔 Raté ! Tu perds tout et vas en prison.'}`);
    }},
    { name: 'beg', execute: async(ctx) => {
        const s = Math.random() > 0.3;
        await ctx.reply(`🥺 *@${ctx.pushName}* fait la manche dans la rue...\n\n${s ? '🪙 Un passant te donne quelques pièces.' : '🚶 Les gens t\'ignorent complètement.'}`);
    }},
    { name: 'gamble', execute: async(ctx) => {
        const s = Math.random() > 0.51; // La maison gagne plus souvent
        await ctx.reply(`🎰 *@${ctx.pushName}* mise tout au casino...\n\n${s ? '🏆 INCROYABLE ! TU GAGNES LE DOUBLE !' : '📉 Aïe... la maison rafle tout.'}`);
    }},
    { name: 'iqtest', execute: async(ctx) => { await ctx.reply(`🧠 Le QI de *@${ctx.pushName}* est de *${Math.floor(Math.random()*150)+50}* !`) } },
    { name: 'gaytest', execute: async(ctx) => { await ctx.reply(`🏳️‍🌈 *@${ctx.pushName}* est gay à *${Math.floor(Math.random()*101)}%* !`) } },
    { name: 'simptest', execute: async(ctx) => { await ctx.reply(`🥺 *@${ctx.pushName}* est simp à *${Math.floor(Math.random()*101)}%* !`) } },
    { name: 'cooltest', execute: async(ctx) => { await ctx.reply(`😎 *@${ctx.pushName}* est cool à *${Math.floor(Math.random()*101)}%* !`) } },
    { name: 'fbi', execute: async(ctx) => { await ctx.reply(`🚨 *FBI OPEN UP !!!*\n\n_Une équipe d\'intervention défonce la porte de ${ctx.args[0]||'quelqu\'un'} !_`) } },
    { name: 'hack', execute: async(ctx) => { 
        const m = await ctx.reply(`_Hacking de ${ctx.args[0]||'la cible'} en cours..._`);
        setTimeout(() => ctx.editMsg(m, `_Hacking terminé à 100%. Données extraites avec succès !_`), 3000);
    }},
    { name: 'nuke', execute: async(ctx) => { await ctx.reply(`☢️ *OGIVE NUCLÉAIRE LANCÉE*\n\nCible: ${ctx.args[0]||'Inconnue'}\nImpact dans 3... 2... 1... BOOOOM !`) } },
    { name: 'magicconch', execute: async(ctx) => {
        const a = ['Oui.','Non.','Rien ne sert d\'essayer.','Peut-être.','Je ne crois pas.','Absolument !'];
        await ctx.reply(`🐚 *La conque magique dit :*\n\n${a[Math.floor(Math.random()*a.length)]}`);
    }},
    { name: 'ship', execute: async(ctx) => {
        const p1 = ctx.args[0] || 'Toi'; const p2 = ctx.args[1] || 'Moi';
        await ctx.reply(`🚢 *SHIPPING*\n\n${p1} ❤️ ${p2}\nCompatibilité : *${Math.floor(Math.random()*101)}%*`);
    }},
    { name: 'duel', execute: async(ctx) => {
        const t = ctx.args[0] || 'le vent';
        const s = Math.random() > 0.5 ? ctx.pushName : t.replace('@','');
        await ctx.reply(`⚔️ *DUEL ÉPIQUE*\n\n*@${ctx.pushName}* affronte *${t}*...\n\nLe grand vainqueur est : *${s}* !!`);
    }},
    { name: 'throw', execute: async(ctx) => {
        const m = ['une brique','une tomate','une chaise','un piano','son téléphone'];
        await ctx.reply(`💨 *@${ctx.pushName}* lance *${m[Math.floor(Math.random()*m.length)]}* sur ${ctx.args[0]||'le mur'} !`);
    }},
    { name: 'summon', execute: async(ctx) => { await ctx.reply(`🔄 *@${ctx.pushName}* trace un pentagramme et invoque *${ctx.args[0]||'un démon'}* !`) } },
    { name: 'curse', execute: async(ctx) => { await ctx.reply(`👿 *@${ctx.pushName}* lance une terrible malédiction sur *${ctx.args[0]||'la zone'}* !`) } },
    { name: 'bless', execute: async(ctx) => { await ctx.reply(`👼 *@${ctx.pushName}* accorde une bénédiction sacrée à *${ctx.args[0]||'tout le monde'}* !`) } }
];
