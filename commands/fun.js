const axios = require('axios');

module.exports = [
    {
        name: 'joke',
        aliases: ['blague'],
        desc: 'Sort une bonne blague croustillante au hasard pour détendre l\'atmosphère.',
        usage: '.joke',
        execute: async (ctx) => {
            const jokes = [
                "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ?\nParce que sinon ils tombent dans le bateau.",
                "Que fait une fraise sur un cheval ?\nDu tagada tagada !",
                "C'est l'histoire d'un pingouin qui respire par les fesses. Un jour il s'assoit et il meurt.",
                "Pourquoi les plongeurs sous-marins ont-ils des appareils photos ?\nParce que les requins aiment les clichés.",
                "Quel est le comble pour un électricien ?\nDe ne pas être au courant."
            ];
            await ctx.reply(`😂 *Blague* :\n\n${jokes[Math.floor(Math.random() * jokes.length)]}`);
        }
    },
    {
        name: 'dice',
        aliases: ['dé'],
        desc: 'Lance un dé magique à 6 faces parfait pour régler un différend.',
        usage: '.dice',
        execute: async (ctx) => {
            await ctx.reply(`🎲 Tu as obtenu : *${Math.floor(Math.random() * 6) + 1}* !`);
        }
    },
    {
        name: 'love',
        aliases: ['amour'],
        desc: 'Calcule sérieusement (ou pas) les affinités amoureuses entre deux personnes.',
        usage: '.love <Nom1> <Nom2>',
        execute: async (ctx) => {
            const p = ctx.currentPrefix || '.';
            if (ctx.args.length < 2) return await ctx.reply(`_Utilisation : \`${p}love Roméo Juliette\`_`);
            const score = Math.floor(Math.random() * 101);
            let emoji = score > 80 ? '💖' : score > 50 ? '💕' : score > 20 ? '💔' : '☠️';
            await ctx.reply(`🔮 *Amour* : ${ctx.args[0]} + ${ctx.args.slice(1).join(' ')} = *${score}%* ${emoji}`);
        }
    },
    {
        name: 'quote',
        aliases: ['citation'],
        desc: 'Cherche dans sa vaste littérature une citation célèbre aléatoire.',
        usage: '.quote',
        execute: async (ctx) => {
            try {
                const res = await axios.get('https://quoteslate.vercel.app/api/quotes/random');
                await ctx.reply(`💬 _"${res.data.quote}"_\n— *${res.data.author}*`);
            } catch (e) {
                await ctx.reply(`💬 _"L'imagination est plus importante que la connaissance."_\n— *Albert Einstein*`);
            }
        }
    },
    {
        name: '8ball',
        desc: 'Posez une question existentielle à la boule de voyance qui dit tout.',
        usage: '.8ball <Ta Question Difficile>',
        execute: async (ctx) => {
            const p = ctx.currentPrefix || '.';
            if (!ctx.q) return await ctx.reply(`_Pose-moi une question ! (ex: \`${p}8ball Vais-je réussir ?\`)_`);
            const answers = ["Absolument.", "C'est certain.", "Sans aucun doute.", "Très probable.", "Oui.", "Réponse floue, réessaie.", "Demande plus tard.", "Mieux vaut ne pas te le dire maintenant.", "N'y compte pas.", "Ma réponse est non.", "Mes sources disent non.", "Très douteux."];
            await ctx.reply(`🎱 *La boule magique dit :*\n${answers[Math.floor(Math.random() * answers.length)]}`);
        }
    },
    {
        name: 'fact',
        aliases: ['saviezvous'],
        desc: 'Révèle de vrais faits étranges et insolites au hasard sur le monde animal ou l\'histoire.',
        usage: '.fact',
        execute: async (ctx) => {
            const facts = [
                "Les pieuvres ont 3 cœurs et du sang bleu.",
                "Le miel ne se gâte jamais. On a retrouvé du miel comestible vieux de 3000 ans en Égypte.",
                "Les dauphins dorment avec un oeil ouvert.",
                "Un jour sur Vénus est plus long qu'une année sur Vénus.",
                "Les framboises font partie de la famille des roses."
            ];
            await ctx.reply(`💡 *Le saviez-vous ?*\n\n${facts[Math.floor(Math.random() * facts.length)]}`);
        }
    },
    {
        name: 'cat',
        aliases: ['chat'],
        desc: 'Soustire à l\'API d\'image une magnifique photo de chaton en HD.',
        usage: '.cat',
        execute: async (ctx) => {
            try {
                const res = await axios.get('https://api.thecatapi.com/v1/images/search');
                await ctx.sock.sendMessage(ctx.from, { image: { url: res.data[0].url }, caption: "🐱 Miaou !" }, { quoted: ctx.msg });
            } catch (e) { await ctx.reply(`_❌ Erreur Image Chat._`); }
        }
    },
    {
        name: 'dog',
        aliases: ['chien'],
        desc: 'Extrait du web les meilleures photos de chiens pour votre satisfaction.',
        usage: '.dog',
        execute: async (ctx) => {
            try {
                const res = await axios.get('https://dog.ceo/api/breeds/image/random');
                await ctx.sock.sendMessage(ctx.from, { image: { url: res.data.message }, caption: "🐶 Ouaf !" }, { quoted: ctx.msg });
            } catch (e) { await ctx.reply(`_❌ Erreur Image Chien._`); }
        }
    },
    {
        name: 'advice',
        aliases: ['conseil'],
        desc: 'Donne un vrai bon conseil philosophique de vie.',
        usage: '.advice',
        execute: async (ctx) => {
            try {
                const res = await axios.get('https://api.adviceslip.com/advice');
                await ctx.reply(`📝 *Conseil du jour :*\n\n"${res.data.slip.advice}"`);
            } catch (e) { await ctx.reply(`_Bois de l'eau._`); }
        }
    },
    {
        name: 'truth',
        aliases: ['verite'],
        desc: 'Propose une redoutable question de "Action ou Vérité". Attention aux secrets...',
        usage: '.truth',
        execute: async (ctx) => {
            const truths = ["Quel est ton plus grand secret ?", "As-tu déjà menti à ton meilleur ami ?", "Quelle est ta pire honte ?", "De quoi as-tu le plus peur ?", "Qui aimes-tu en secret ?"];
            await ctx.reply(`🤫 *VÉRITÉ*\n\n${truths[Math.floor(Math.random() * truths.length)]}`);
        }
    },
    {
        name: 'dare',
        aliases: ['action'],
        desc: 'L\'ultime défi "Action" du jeu classique, seras-tu game de le faire ?',
        usage: '.dare',
        execute: async (ctx) => {
            const dares = ["Mets une photo dossier en photo de profil pendant 1h.", "Envoie un message vocal de toi qui chantes.", "Révèle le contenu de ton dernier SMS.", "Appelle une personne au hasard et dis 'Je sais tout'.", "Parle avec l'accent canadien pendant 5 minutes."];
            await ctx.reply(`🔥 *ACTION*\n\n${dares[Math.floor(Math.random() * dares.length)]}`);
        }
    },
    {
        name: 'flipcoin',
        aliases: ['pileouface'],
        desc: 'Lance la célèbre pièce de 50 centimes pour faire face au destin (pile/face).',
        usage: '.flipcoin',
        execute: async (ctx) => {
            const res = Math.random() < 0.5 ? "Pile" : "Face";
            await ctx.reply(`🪙 La pièce est lancée et tombe sur... *${res}* !`);
        }
    },
    {
        name: 'rps',
        aliases: ['pfc'],
        desc: 'Battez le bot intelligent au célèbre Pierre-Feuille-Ciseaux.',
        usage: '.rps <pierre|feuille|ciseaux>',
        execute: async (ctx) => {
            const pfx = ctx.currentPrefix || '.';
            if (!ctx.args[0]) return await ctx.reply(`_Choisis : \`${pfx}rps pierre\`, \`${pfx}rps feuille\` ou \`${pfx}rps ciseaux\`_`);
            const p = ctx.args[0].toLowerCase();
            if (!['pierre','feuille','ciseaux'].includes(p)) return;
            const b = ['pierre','feuille','ciseaux'][Math.floor(Math.random() * 3)];
            let res = (p===b) ? "Égalité" : ((p==='pierre'&&b==='ciseaux')||(p==='feuille'&&b==='pierre')||(p==='ciseaux'&&b==='feuille')) ? "Tu as gagné !" : "Le bot a gagné !";
            await ctx.reply(`🤖 Tu as joué *${p}*\n🤖 J'ai joué *${b}*\n\n> *${res}*`);
        }
    },
    {
        name: 'meme',
        desc: 'Télécharge une Image humoristique (Meme) drôle extraite en direct de Reddit.',
        usage: '.meme',
        execute: async (ctx) => {
            try {
                const res = await axios.get('https://meme-api.com/gimme');
                await ctx.sock.sendMessage(ctx.from, { image: { url: res.data.url }, caption: `😂 *${res.data.title}*` }, { quoted: ctx.msg });
            } catch (e) { await ctx.reply(`_❌ Meme indisponible._`); }
        }
    },
    {
        name: 'anime',
        desc: 'Consulte l\'encyclopédie mondiale Jikan(MyAnimeList) pour trouver la carte détaillée d\'un manga.',
        usage: '.anime <titre>',
        execute: async (ctx) => {
            if (!ctx.q) return await ctx.reply(`_Précisez le nom de l'anime._`);
            try {
                const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(ctx.q)}&limit=1`);
                const anime = res.data.data[0];
                let txt = `⛩️ *${anime.title}*\n⭐ Score: ${anime.score}\n📺 Episodes: ${anime.episodes}\n📅 Année: ${anime.year}\n\n📝 Synopsis: ${anime.synopsis?.slice(0, 300)}...`;
                await ctx.sock.sendMessage(ctx.from, { image: { url: anime.images.jpg.large_image_url }, caption: txt }, { quoted: ctx.msg });
            } catch (e) { await ctx.reply(`_❌ Anime non trouvé._`); }
        }
    },
    {
        name: 'crypto',
        aliases: ['btc'],
        desc: 'Scrape les bourses mondiales live pour extraire les valeurs du Bitcoin (BTC) etc.',
        usage: '.crypto',
        execute: async (ctx) => {
            try {
                const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=usd');
                const d = res.data;
                await ctx.reply(`💹 *Marché Crypto*\n\n🟠 BTC : $${d.bitcoin.usd}\n🔵 ETH : $${d.ethereum.usd}\n🟣 SOL : $${d.solana.usd}\n🐕 DOGE: $${d.dogecoin.usd}`);
            } catch (e) { await ctx.reply(`_❌ API indisponible._`); }
        }
    },
    {
        name: 'riddle',
        aliases: ['devinette'],
        desc: 'Pose une énigme difficile et exige ton cerveau. Donne la réponse dans 15 secondes.',
        usage: '.riddle',
        execute: async (ctx) => {
            const r = [
                { q: "Qu'est ce qui a un cou mais pas de tête ?", a: "Une bouteille" },
                { q: "Plus il est chaud, plus il est frais. Qu'est-ce ?", a: "Le pain" },
                { q: "Je suis d'eau mais si on me met dans l'eau, je meus. Qui suis-je ?", a: "Un glaçon" },
                { q: "Qu'est ce qui est plein de trous mais retient l'eau ?", a: "Une éponge" }
            ];
            const item = r[Math.floor(Math.random() * r.length)];
            await ctx.reply(`🧩 *Devinette*\n\n${item.q}\n\n_Indice: c'est ${item.a.toLowerCase().slice(0, 4)}... (Pour la réponse, utilise ton cerveau !)_`);
            setTimeout(() => ctx.reply(`💡 Réponse : *${item.a}*`), 15000);
        }
    },
    {
        name: 'compliment',
        desc: 'Lâche une énorme phrase bienfaisante pour le bonheur narcissique.',
        usage: '.compliment [@user]',
        execute: async (ctx) => {
            const comps = ["Tu es comme le soleil, tu illumines ma journée.", "Ton sourire est contagieux !", "Tu es plus intelligent(e) que tu ne le crois.", "Le monde est meilleur avec toi dedans.", "Superbe photo de profil !"];
            const target = ctx.args[0] || "Toi là";
            await ctx.reply(`✨ ${target}, ${comps[Math.floor(Math.random() * comps.length)]}`);
        }
    },
    {
        name: 'insult',
        desc: 'Injurie massivement de manière humoristique la personne visée.',
        usage: '.insult [@user]',
        execute: async (ctx) => {
            const target = ctx.args[0] || "Toi";
            const ins = ["tu as le QI d'une huître restée trop longtemps au soleil.", "même un poisson rouge as plus de mémoire que toi.", "si l'ignorance valait de l'or, tu serais le roi du monde.", "tu es la raison pour laquelle les aliens refusent de nous visiter."];
            await ctx.reply(`🤡 ${target}, ${ins[Math.floor(Math.random() * ins.length)]}`);
        }
    },
    {
        name: 'motivation',
        desc: 'Envoie un gros coup de pied aux devises mondiales "Stay strong bro !".',
        usage: '.motivation',
        execute: async (ctx) => {
            const mots = ["Lève-toi avec détermination, couche-toi avec satisfaction.", "Le succès commence par croire en soi-même.", "N'attends pas les opportunités, crée-les.", "Les erreurs sont les preuves que tu essaies.", "Rien n'est impossible, le mot lui-même dit 'I'm possible'."];
            await ctx.reply(`💪 *MOTIVATION*\n\n${mots[Math.floor(Math.random() * mots.length)]}`);
        }
    },
    {
        name: 'math',
        desc: 'Affiche un fait historique ou mathématique extrêmement compliqué tiré d\'API.',
        usage: '.math',
        execute: async (ctx) => {
            try {
                const res = await axios.get('http://numbersapi.com/random/math');
                await ctx.reply(`🔢 *Fait Mathématique :*\n\n${res.data}`);
            } catch (e) { await ctx.reply(`_Les maths c'est dur._`); }
        }
    },
    {
        name: 'password',
        desc: 'Génère un mot de passe blindé Alphanumérique complexe de 12 à 16 lettres pour toi.',
        usage: '.password',
        execute: async (ctx) => {
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
            let pwd = "";
            for (let i = 0; i < 16; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
            await ctx.reply(`🔐 *Mot de passe généré :*\n\n\`\`\`${pwd}\`\`\``);
        }
    },
    {
        name: 'bored',
        desc: 'Interroge l\'API BoreD pour t\'affecter une tâche précise quand tu n\'a rien à foutre.',
        usage: '.bored',
        execute: async (ctx) => {
            try {
                const res = await axios.get('https://www.boredapi.com/api/activity/');
                await ctx.reply(`🥱 *Tu t'ennuies ?*\n\n${res.data.activity}`);
            } catch (e) { await ctx.reply(`_Va lire une bonne documentation technique ! (ex: Docs de Baileys)_`); }
        }
    }
];
