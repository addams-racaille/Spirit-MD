# 🌌 Spirit MD — Bot WhatsApp Multi-Fonctions

<div align="center">
  <img src="https://telegra.ph/file/ed21a0a5628cb39180b7e.jpg" alt="Spirit MD Logo" width="200" style="border-radius: 50%;">
  <p align="center">
    <a href="https://github.com/addams-racaille/Spirit-MD">
      <img src="https://img.shields.io/github/stars/addams-racaille/Spirit-MD?style=for-the-badge&color=blue&logo=github" alt="Stars">
    </a>
    <a href="https://github.com/addams-racaille/Spirit-MD/network/members">
      <img src="https://img.shields.io/github/forks/addams-racaille/Spirit-MD?style=for-the-badge&color=cyan&logo=github" alt="Forks">
    </a>
    <img src="https://img.shields.io/badge/Maintenu-Oui-green?style=for-the-badge" alt="Maintained">
    <img src="https://img.shields.io/badge/Langue-Français-ff69b4?style=for-the-badge" alt="Language">
  </p>
</div>

---

## 📖 Présentation

**Spirit MD** est un bot WhatsApp ultra-complet, performant et modulaire, conçu pour offrir une expérience utilisateur fluide et sécurisée. Que ce soit pour la gestion de groupes, le divertissement ou l'optimisation de vos serveurs, Spirit MD s'adapte à tous vos besoins.

Développé avec la bibliothèque `@whiskeysockets/baileys`, il est optimisé pour une exécution 24h/24 sur VPS avec une gestion intelligente des ressources et une base de données SQLite robuste.

---

## ✨ Fonctionnalités Clés

### 🛡️ Modération & Sécurité
- **Anti-Delete & Anti-Edit** : Ne ratez plus rien. Le bot détecte les messages supprimés ou modifiés et vous informe instantanément.
- **Système d'Avertissement (Warn)** : Gérez les membres récalcitrants avec `.warn`. Expulsion automatique après 3 avertissements.
- **Blacklist Automatique** : Filtrage de mots-clés interdits avec action immédiate.
- **Gestion de Groupe via Commandes** : `.promote`, `.demote`, `.kick`, `.group open/close`, `.hidetag`.

### ⚡ SaaS & Multi-Hosting (Exclusif)
- **Hébergement Dynamique** : Capacité de lancer et gérer plusieurs instances de bots directement via le bot principal.
- **Gestion de Sessions** : Interface simplifiée pour connecter de nouveaux comptes via Pairing Code.

### 🎨 Médias & Outils
- **Sticker Maker** : Créez des stickers animés ou statiques en un clin d'œil (`.s`, `.sticker`).
- **YouTube Downloader** : Téléchargez vos musiques préférées au format audio de haute qualité (`.play`).
- **Vues Uniques (VV)** : Révélez le contenu des messages WhatsApp à vue unique (`.vv`).
- **Utilitaires** : Wikipedia, Météo, Calculatrice, QR Code, Raccourcisseur d'URL.

### 🎮 Divertissement & Jeux
- **Jeux Intéractifs** : Morpion (Tic-Tac-Toe) et bien d'autres.
- **Social** : Commandes de blagues, tests d'amour, et interactions communautaires.

---

## 🛠️ Installation & Configuration

### Prérequis
- [Node.js](https://nodejs.org/) v20 ou supérieur.
- [FFmpeg](https://ffmpeg.org/) (nécessaire pour les stickers et l'audio).
- [PM2](https://pm2.keymetrics.io/) pour le déploiement sur VPS.

### 1. Installation Rapide
```bash
git clone https://github.com/addams-racaille/Spirit-MD.git
cd Spirit-MD
npm install
```

### 2. Configuration
Renommez le fichier `.env.example` en `.env` et remplissez vos informations :
```env
PREFIX=.
BOT_NAME="Spirit MD"
OWNER_NUMBER="226XXXXXXXX"
```

### 3. Lancement
**Mode Développement :**
```bash
npm start
```
**Mode VPS (Production avec PM2) :**
```bash
npm run vps
pm2 logs
```

---

## 🚀 Optimisations Techniques

- **SQLite (WAL Mode)** : Performances de base de données accrues pour éviter les verrouillages lors des accès concurrentiels.
- **Node-Cache** : Gestion dynamique de la mémoire pour prévenir les fuites de mémoire (Memory Leaks).
- **Architecture Modulaire** : Une séparation claire entre les commandes, les événements et les handlers pour une maintenance facile.

---

## 🤝 Contribution & Support

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une *Issue* ou à soumettre une *Pull Request*.

- **Développeur Principal** : [Addams-Racaille](https://github.com/addams-racaille)
- **Base Project** : Spirit MD Multi-Device

---

<p align="center">
  Développé avec ❤️ pour la communauté WhatsApp.
</p>
