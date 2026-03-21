# 🤖 Spirit-MD (WhatsApp Bot)

Bienvenue sur **Spirit-MD**, un bot WhatsApp complet, puissant et optimisé pour tourner 24h/24 sur serveur (VPS). Développé avec `Baileys`, ce bot intègre des fonctionnalités de modération approfondies, des filtres automatiques de sécurité, et une multitude de commandes intelligentes.

---

## 🚀 Fonctionnalités Principales

### 🛡️ Sécurité & Modération
- **Anti-Delete** : Si quelqu'un supprime un message, le bot le capture et vous l'enverra discrètement en Privé (ou publiquement dans le groupe, au choix).
- **Anti-Edit** : Traque tous les messages modifiés WhatsApp et affiche l'Avant/Après instantanément.
- **Blacklist Globale** : Le bot supprime automatiquement n'importe quel message contenant un mot interdit et avertit l'utilisateur récalcitrant.
- **Autokick / Warns** : Système d'avertissement complet (`.warn`). Arrivé à 3, le bot expulse automatiquement le membre fautif.
- **Exceptions (`.except`)** : Liste blanche permettant d'ignorer ces règles pour vos admins ou amis proches.

### 📋 Gestion de Groupes
- `.promote <@user>` / `.demote <@user>` : Gestion des rôles rapides sans passer par les menus WhatsApp.
- `.link` : Envoie instantanément le lien d'invitation du groupe (si le bot est administrateur).
- `.group <open|close>` : Verrouille / Déverrouille les conversations de tout le groupe en 1 seconde.
- `.hidetag <message>` : Permet aux Owner de pinger silencieusement 100% des membres sans polluer l'écran par des dizaines d'arobases.

### 🎨 Médias, Stickers & Musique
- **Générateur de Stickers Performant** : Envoyez `.sticker` (ou `.s`) en réponse à une vidéo courte ou une image. Mode `.crop` inclus pour forcer un découpage carré !
- **Musique YouTube** : Tape `.play <nom de chanson>` ; le bot va récupérer et compresser sa piste audio complète et te l'envoyer nativement sur WhatsApp au format `.mp3`.
- **Révélateur de Vues Uniques** : Réponds à une image/vidéo privée avec `.vv`, le bot capturera l'image secrète pour toi.

### 🌐 Utilitaires Intelligents & Jeux
- `.wiki <sujet>` : Recherche encyclopédique
- `.weather <ville>` : Données météorologiques ultra-complètes et en temps réel
- `.tts <lang> <texte>` : Google Text-to-Speech (Voix de synthèse audio envoyée en vocal WhatsApp)
- `.github <user>` / `.qr <texte>` / `.short <url>`
- `.love` / `.dice` / `.joke` : Outils sociaux interactifs
- `.calc` : Calculatrice instantanée intégrée avec gestion Priorités

---

## ⚙️ Installation Rapide (Ubuntu VPS)

L'installation a été grandement facilitée via `pm2` et des patchs sur SQLite (`journal_mode=WAL`).

### 1. Prérequis & Téléchargement
```bash
sudo apt update && sudo apt install -y curl git ffmpeg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

git clone https://github.com/votre-user/Spirit-MD.git
cd Spirit-MD
npm install
```

### 2. Configuration environnementale
Créez un fichier `.env` ou renommez le fichier fourni :
```bash
mv .env.example .env
nano .env
```
_Configurez vos variables :_
```env
PREFIX=.
BOT_NAME=Spirit MD
OWNER_NUMBER=33612345678
```

### 3. Démarrage Infini
```bash
npm run vps
pm2 logs
```
_Faites un **Ctrl+C** une fois votre QR-Code ou Pairing-Code scanné, le bot survivra en fond de tâche._

---
> Mode `WAL` activé pour des lectures-écritures base-de-données concurrentielles sans blocage. Gestion des caches par module mémoire dynamique expiré (Node-Cache) pour annuler les Memory Leaks inhérents au Javascript asynchrone sur de longues sessions.
