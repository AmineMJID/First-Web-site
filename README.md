# 🎓 Student Portal

Portail scolaire complet (administration, enseignants, élèves) construit avec **Next.js 16**, **React 19** et **SQLite natif de Node.js** (`node:sqlite`) — aucune dépendance native à compiler.

## ✨ Fonctionnalités

| Rôle | Fonctionnalités |
|------|-----------------|
| **Admin** | Tableau de bord & rapports (tendances de présence, répartition des notes, top / élèves à risque), gestion des élèves & enseignants (création avec identifiants auto-générés, réinitialisation mot de passe / 2FA, export CSV), **gestion des emplois du temps** (détection de conflits), messagerie (annonces, envoi par classe / destinataires multiples, accusés de lecture) |
| **Enseignant** | Carnet de notes par matière / trimestre / classe avec remarques, saisie de présence par jour avec historique, emploi du temps personnel, messagerie vers élèves |
| **Élève** | Notes par trimestre avec évolution, calendrier de présence, emploi du temps, messagerie |
| **Tous** | 3 langues (FR / EN / AR avec RTL), thème sombre, page Paramètres (changement de mot de passe), responsive mobile |

### Sécurité
- Sessions JWT en cookie `httpOnly`, secret configurable (`JWT_SECRET`)
- **2FA TOTP obligatoire** pour admins & enseignants (Google Authenticator, Authy…)
- Tokens temporaires 2FA (10 min) ne pouvant pas ouvrir de session
- Limitation des tentatives de connexion (10 / 15 min)
- Mot de passe temporaire à changer à la première connexion
- Validation serveur de toutes les entrées, contrôle d'accès par rôle sur chaque route

## 🚀 Démarrage

Prérequis : **Node.js ≥ 22.5** (pour `node:sqlite`).

```bash
npm install
cp .env.example .env.local   # puis définir JWT_SECRET
npm run dev
```

Ouvrir http://localhost:3000. La base `data/portal.db` est créée et **remplie automatiquement avec des données de démo** au premier lancement.

### Comptes de démonstration

| Rôle | Identifiant | Mot de passe |
|------|-------------|--------------|
| Admin | `admin` | `admin123` |
| Enseignant | `teacher1` / `teacher2` / `teacher3` | `teacher123` |
| Élève | `alice`, `bob`, `carol`, … | `student123` |

> Au premier login admin / enseignant, un QR code 2FA s'affiche : scannez-le avec une application d'authentification.

## 🧰 Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run seed` | Remplit la base si elle est vide (`-- --force` pour réinitialiser) |
| `npm test` | Tests API end-to-end (nécessite un serveur lancé, `BASE_URL` optionnel) |
| `npm run lint` | ESLint |

## ⚙️ Variables d'environnement

Voir [`.env.example`](.env.example) : `JWT_SECRET`, `DATABASE_PATH`, `AUTO_SEED`, `COOKIE_SECURE`.

## 🗂️ Structure

```
app/
  api/            Routes API (auth, students, teachers, grades, attendance, messages, schedule, reports, classes)
  dashboard/      Pages par rôle (admin / teacher / student) + settings partagé
  login/          Connexion + 2FA
components/       Toast, Modal, ConfirmDialog, Timetable, Messaging
lib/
  db.js           Couche SQLite (node:sqlite) + schéma + migrations
  auth.js         JWT, hachage, helpers de session
  api.js          Helpers pour les routes (requireRole, validation…)
  i18n/           Traductions fr / en / ar
proxy.js          Protection des routes & contrôle d'accès (ex-middleware)
scripts/seed.js   Données de démonstration
tests/            Tests API (node:test)
```
