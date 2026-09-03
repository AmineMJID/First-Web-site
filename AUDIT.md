# Audit du projet — School Portal

**Date :** 3 septembre 2026
**Branche :** `arena/01a067e4-first-web-site` (base : `33fc694` — *"Mise à jour : correction login"*)
**Méthode :** lecture complète du code (62 fichiers) + exécution réelle de l'application et tests de chaque flux (auth, RBAC, CRUD, build, lint).

---

## Résumé exécutif

Le projet est **bien plus avancé que ce que le README laisse croire** : c'est un vrai portail scolaire à 3 rôles, trilingue, avec base de données, API REST et 14 pages. Environ **80 % de la vision « v1 » est déjà codée**.

Mais il y a un problème majeur, vérifié en live :

> **Les comptes administrateur et enseignant ne peuvent pas se connecter du tout.** Seuls les élèves peuvent se connecter.

Et un problème de sécurité critique :

> **L'authentification à deux facteurs (2FA) est contournable en une requête** : le jeton temporaire émis *avant* la 2FA fonctionne comme une session complète.

Enfin, **`next build` échoue** : l'application ne peut pas être déployée en production en l'état.

Le reste (RBAC, CRUD, i18n, thèmes) fonctionne correctement. Ce sont donc surtout des corrections ciblées, pas une réécriture.

###État en un coup d'œil

| Domaine | État | Note |
|---|---|---|
| Modèle de données (7 tables) | ✅ Bon | Quelques colonnes inutilisées |
| Auth élève | ✅ Fonctionne | — |
| Auth admin / enseignant | 🔴 **Cassé** | Deux bloquants indépendants |
| 2FA | 🔴 **Cassé + contournable** | Route 500 + bypass complet |
| RBAC (droits d'accès) | ✅ Efficace | Deux failles IDOR à corriger |
| Pages & UI (14 pages) | ✅ Solide | Navigation mobile cassée |
| i18n FR/EN/AR + RTL | ✅ Complet | 155 clés, 3 langues complètes |
| Thème clair/sombre | ✅ Fonctionne | — |
| Build / déploiement | 🔴 **Échoue** | 2 erreurs bloquantes |
| Tests / CI / Docker | ⚪ **Inexistant** | 0 test |
| Documentation | 🔴 README par défaut | Aucune doc projet |

---

## 1. Ce qui a déjà été fait

### Stack
- **Next.js 16.1.6** (App Router, Turbopack) + **React 19.2.3**
- **SQLite** via `better-sqlite3` + `jose` (JWT) + `bcryptjs` (mot de passe) + `otplib`/`qrcode` (2FA)
- `lucide-react` (icônes), `eslint-config-next`
- CSS maison : `app/globals.css` (788 lignes, design system avec variables CSS)

### Modèle de données (`lib/db.js`)
7 tables avec clés étrangères et `ON DELETE CASCADE` : `users`, `students`, `teachers`, `grades`, `attendance`, `messages`, `schedules`. Migration légère automatique pour l'ajout de la colonne `two_factor_secret`.

### Authentification & sécurité (intention)
- Login par username/password, hachage **bcrypt** (coût 10)
- JWT signé en **cookie `httpOnly`**, `sameSite=lax`, `secure` en production, durée 24 h
- **2FA TOTP avec QR code** prévue pour les rôles `admin` et `teacher`
- **Middleware** (`middleware.js`) : protège `/`, `/dashboard/*`, `/api/*`, redirige vers le dashboard du rôle, injecte `x-user-id` / `x-user-role` dans les en-têtes

### API REST — 15 fichiers, 9 groupes de routes
`auth/login`, `auth/logout`, `auth/me`, `auth/setup-2fa`, `auth/verify-2fa`, `students` (+`[id]`), `teachers`, `grades`, `attendance`, `messages` (+`[id]`), `schedule`, `reports`

### Interfaces — 3 rôles, 14 pages
- **Admin** : tableau de bord (statistiques), gestion des élèves (CRUD complet), gestion des enseignants, messagerie, rapports
- **Enseignant** : tableau de bord, saisie des notes, appel de présence, messagerie
- **Élève** : tableau de bord, emploi du temps, notes, présences, messagerie

### Fonctionnalités transverses
- **i18n** : français (défaut), anglais, arabe — **155 clés, aucune traduction manquante**, avec bascule **RTL** complète
- **Thème clair / sombre** persistant (`localStorage`), appliqué via `data-theme`
- Sidebar animée (extension au survol), cartes animées, badges de rôle, menu de langue
- **Jeu de données de démo réaliste** (`lib/seed.js`) : 1 admin, 3 enseignants, 15 élèves, 180 notes, 330 présences, 30 cours, 5 messages

---

## 2. Ce que j'ai vérifié qui fonctionne (tests réels)

J'ai lancé l'application et exécuté chaque flux :

| Test | Résultat |
|---|---|
| `GET /` sans session | ✅ 307 → `/login` |
| `GET /api/students` sans session | ✅ 401 |
| Login élève (`alice` / `student123`) | ✅ 200 + cookie de session |
| `GET /api/auth/me` | ✅ 200 |
| Les 5 pages élève | ✅ 200 |
| Élève → `GET /api/students` (admin only) | ✅ 403 |
| Élève → `GET /api/reports` (admin only) | ✅ 403 |
| Élève → `POST /api/grades` | ✅ 403 |
| Élève → `/dashboard/admin` | ✅ 307 → `/dashboard/student` |
| Admin crée un élève | ✅ 201 (génère username + mot de passe) |
| Enseignant saisit une note | ✅ 200 |
| Enseignant prend une présence | ✅ 200 |
| Admin publie une annonce | ✅ 201 |
| Les 14 pages (admin/enseignant/élève) | ✅ 200, aucune erreur runtime |
| Parité i18n FR/EN/AR | ✅ 155 / 155 / 155 |

**Le contrôle d'accès par rôle est donc réellement efficace** sur les routes principales et les pages. Les problèmes sont ailleurs.

---

## 3. Bloquants (P0) — à corriger en priorité

### 3.1 🔴 Admin et enseignant ne peuvent pas se connecter

Le login des rôles `admin` et `teacher` exige obligatoirement la 2FA (`app/api/auth/login/route.js:19-40`) : il ne pose **jamais** le cookie de session, il renvoie un `tempToken`. Pour obtenir une session, il faut appeler `setup-2fa` puis `verify-2fa`. Or **ces deux routes sont cassées**, par deux bugs indépendants :

**Bug A — le middleware bloque les routes 2FA (401).**
`middleware.js:13` liste les routes publiques et n'inclut **ni** `/api/auth/setup-2fa` **ni** `/api/auth/verify-2fa`. Comme le matcher couvre `/api/:path*`, ces routes exigent un cookie de session valide — précisément ce que l'utilisateur n'a pas encore, puisqu'il est en train de se connecter.

```
GET /api/auth/setup-2fa?tempToken=...  →  401 {"error":"Unauthorized"}
POST /api/auth/verify-2fa              →  401 {"error":"Unauthorized"}
```

**Bug B — `otplib` v13 a changé d'API, les routes plantent (500).**
`otplib` v13 n'a **plus d'export par défaut ni d'objet `authenticator`**. Or les deux routes font :

```js
import pkg from 'otplib';
const { authenticator } = pkg;   // → undefined
```

En forçant le passage du middleware (avec un cookie valide), les deux routes renvoient **500**. L'API réelle de `otplib` v13 est : `generateSecret`, `generate`, `generateURI`, `verify`, `verifySync`, `TOTP`, `HOTP`, `OTP`.

**Conséquence :** la page de login affiche « Failed to load 2FA setup » (`app/login/page.js:67`). Aucun admin, aucun enseignant ne peut entrer. L'application n'est utilisable que par les élèves.

### 3.2 🔴 La 2FA est contournable en une requête (critique)

`middleware.js` vérifie uniquement la **signature** du JWT. Il ne vérifie **jamais** le flag `temp` que porte le jeton temporaire. Résultat : le `tempToken` émis après un simple login (avant tout code 2FA) est accepté comme session pleine et entière.

Vérifié en live — avec uniquement le nom d'utilisateur et le mot de passe de l'admin :

```
Cookie: auth-token=<tempToken>  →  GET /api/auth/me     → 200 (Dr. Sarah Mitchell, admin)
Cookie: auth-token=<tempToken>  →  GET /dashboard/admin → 200
Cookie: auth-token=<tempToken>  →  GET /api/reports     → 200 (toutes les stats)
```

**Un attaquant qui connaît le mot de passe d'un admin ou d'un enseignant obtient un accès complet sans jamais fournir de code 2FA.** La 2FA ne protège donc contre rien aujourd'hui.

Aggravant : le commentaire (`app/api/auth/login/route.js:23`) annonce 10 minutes, mais le code passe `'24h'` (ligne 30) — le jeton temporaire est valable 24 h.

### 3.3 🔴 Le build de production échoue

```
npx next build
⨯ Export default doesn't exist in target module
  ./app/api/auth/setup-2fa/route.js:5:1
  ./app/api/auth/verify-2fa/route.js:5:1
```

**L'application ne peut pas être déployée.** (Même cause que le bug 3.1-B.)

`npx eslint .` remonte aussi **2 erreurs** et 2 avertissements :
- `app/dashboard/layout.js:61` — `setState` synchrone dans un effet
- `lib/LanguageContext.js:19` — accès à une variable avant sa déclaration
- `app/dashboard/admin/students/page.js:27` — dépendance d'effet manquante
- `app/login/page.js:246` — `<img>` au lieu de `next/image`

---

## 4. Sécurité (P1)

| # | Problème | Détail |
|---|---|---|
| 4.1 | **Secret JWT codé en dur** | `lib/auth.js:5` contient `'student-portal-secret-key-2024-super-secure'` en clair dans le dépôt. N'importe qui peut forger des jetons valides. |
| 4.2 | **Incohérence de clé** | `middleware.js:5-7` lit `process.env.JWT_SECRET`, `lib/auth.js:5` ne le lit **pas**. Définir la variable d'environnement sépare les clés de signature et de vérification → **toutes les sessions deviennent invalides**. Piège sérieux. |
| 4.3 | **IDOR — fuite de données personnelles** | `GET /api/students/[id]` (`app/api/students/[id]/route.js:5`) n'a **aucun contrôle de rôle**. Vérifié : un élève connecté récupère la fiche complète d'un autre élève (date de naissance, adresse, e-mail, nom + téléphone des parents) en changeant l'identifiant. |
| 4.4 | **IDOR — messagerie** | `PUT /api/messages/[id]` (`app/api/messages/[id]/route.js:5`) permet à n'importe quel utilisateur connecté de marquer n'importe quel message comme lu. Aucune vérification de propriété. |
| 4.5 | **Secret 2FA fourni par le client** | `verify-2fa` accepte `setupSecret` depuis le corps de la requête (lignes 30-38). Un attaquant muni d'un `tempToken` peut enrôler **son propre** secret (qu'il maîtrise) → persistance d'accès. Le secret doit être généré et conservé côté serveur. |
| 4.6 | **Aucune limitation de tentatives** | Pas de rate limiting sur `/api/auth/login` → force brute et « credential stuffing » possibles. |
| 4.7 | **Journaux contenant des secrets** | `lib/auth.js:32-34` écrit le **JWT complet** et l'erreur dans `portal_debug.log` à chaque échec de vérification. `lib/auth.js:13` journalise le nom d'utilisateur à chaque signature. 12 `console.log` au total dans `app/` et `lib/`. |
| 4.8 | **Aucune validation des entrées** | Aucune bibliothèque de validation (pas de `zod`). Les corps de requête sont utilisés directement. Pas de protection CSRF. |
| 4.9 | **Mots de passe en clair dans les réponses** | `POST /api/students` renvoie le mot de passe généré en clair. Utile à l'admin, mais devrait être un affichage unique et jamais journalisé. |

---

## 5. Bugs et qualité (P2)

| # | Problème | Détail |
|---|---|---|
| 5.1 | **`/api/auth/me` renvoie un mauvais `id`** | `{...user, ...extendedInfo}` : l'`id` de la table `students`/`teachers` écrase l'`id` de l'utilisateur. Vérifié : `alice` a l'id utilisateur 5, l'API renvoie `id: 1` et `user_id: 5`. Toute fonctionnalité se basant sur cet `id` sera fausse. |
| 5.2 | **Le script de seed n'est pas idempotent** | `lib/seed.js` code en dur les identifiants 1-15 alors que les compteurs `AUTOINCREMENT` continuent. Rejouer le seed sur une base existante plante : `FOREIGN KEY constraint failed`. Vérifié sur la base du dépôt (compteur élèves à 31, enseignants 4-6 alors que le code attend 1-3). |
| 5.3 | **Pas de script npm pour le seed** | Aucun `"seed"` dans `package.json`. De plus `lib/seed.js` est en ESM dans un paquet CommonJS : `node lib/seed.js` échoue. |
| 5.4 | **Navigation mobile cassée** | `setMobileSidebar(true)` n'est **jamais appelé** : il n'existe aucun bouton « hamburger ». La sidebar ne s'ouvre qu'au survol (`onMouseEnter`), inopérant au toucher. Sur mobile, la navigation est réduite à une barre de 72 px inutilisable. |
| 5.5 | **Imports morts et nav fantôme** | `Bell`, `Settings`, `Menu`, `X`, `ChevronLeft`, `ChevronRight` sont importés sans être utilisés. Aucune route `/settings` ou `/profile` n'existe, alors que le fichier de traduction les mentionne. |
| 5.6 | **Dépréciation Next.js 16** | `middleware.js` devrait s'appeler `proxy.ts` — avertissement au démarrage. |
| 5.7 | **Avertissements de modules** | Les fichiers `.js` utilisent ESM sans `"type": "module"` → Node les reparse à chaque exécution (surcoût, avertissement). |

---

## 6. Hygiène du dépôt

- 🔴 **Bases de données versionnées dans Git** : `data/portal.db` (+ `-wal`, `-shm`) et un trio `school.db` **obsolète** à la racine (4 Ko + 32 Ko + 86 Ko, référencé nulle part dans le code — `DB_PATH` pointe vers `data/portal.db`). Aucune entrée `.gitignore` ne les excluait.
  → **Corrigé dans cette session** : `.gitignore` mis à jour, fichiers dé-tracés, `school.db*` supprimé.
- 🔴 **README** : c'est encore le modèle `create-next-app`. Aucune instruction d'installation, aucun identifiant de démo, aucune description de l'architecture.
- ⚪ **Aucun test** (0 fichier `*.test.*` / `*.spec.*`)
- ⚪ **Aucune CI** (pas de `.github/workflows`)
- ⚪ **Pas de Docker**, pas de `.env.example`
- ⚪ Pas de page d'erreur personnalisée (404/500), pas de `error boundary`

---

## 7. Ce qui manque pour en faire « le meilleur portail scolaire »

### Essentiels (attendus d'un portail scolaire moderne)
- **Mot de passe oublié / réinitialisation** et changement de mot de passe
- **Page profil** + avatar (la colonne `avatar` existe, inutilisée)
- **Espace parents** : `parent_name` / `parent_phone` sont stockés mais aucun parent ne peut se connecter. C'est souvent **LA** fonctionnalité différenciante d'un portail scolaire.
- **Gestion de l'emploi du temps côté admin** : la table `schedules` est remplie par le seed, mais **aucune interface ne permet de la modifier**. Les élèves la consultent en lecture seule.
- **Gestion des classes et matières** : `class_name` est une simple chaîne libre. Il n'existe pas de table `classes` ni `subjects`.
- **Devoirs / travaux** (assignments) avec dépôt et notation
- **Bulletins scolaires** exportables en PDF (la page « Rapports » n'affiche que des agrégats)

### Importants
- **Notifications** : l'icône cloche est importée mais non implémentée ; aucun centre de notification, aucun e-mail
- **Recherche, tri et pagination** : la page élèves charge tout d'un coup
- **Export de données** (CSV / Excel)
- **Journal d'audit** (qui a modifié quoi et quand) — important dans un contexte scolaire
- **Finances / frais de scolarité**, bibliothèque, examens

### Qualité produit
- **Accessibilité** (a11y) : navigation clavier, contrastes, lecteurs d'écran
- **Responsive** réel (la navigation mobile est cassée — cf. 5.4)
- Tests automatisés et CI
- Contrôle fin des droits : aujourd'hui un enseignant peut saisir une note pour **n'importe quel** élève, sans lien avec sa classe ou sa matière

---

## 8. Plan d'action recommandé

### Phase 0 — Débloquer (≈ 1 journée) — *à faire en priorité absolue*
1. Corriger l'import `otplib` vers l'API v13 (`generateSecret`, `generateURI`/`generate`, `verify`) → débloque le login admin/enseignant **et** le build
2. Ajouter `/api/auth/setup-2fa` et `/api/auth/verify-2fa` aux routes publiques du middleware
3. **Faire rejeter tout jeton portant `temp: true` dans le middleware** → colmate le contournement de la 2FA
4. Réduire la durée du jeton temporaire à 5-10 min
5. Sortir le secret JWT dans `.env` **via un module unique** partagé par `lib/auth.js` et le middleware (corrige 4.1 et 4.2 ensemble)
6. Corriger l'`id` renvoyé par `/api/auth/me`

### Phase 1 — Sécuriser (2-3 jours)
7. Contrôles de rôle sur `GET /api/students/[id]` et de propriété sur `PUT /api/messages/[id]`
8. Générer et stocker le secret 2FA **côté serveur**, ne plus accepter `setupSecret` du client
9. Rate limiting sur le login + verrouillage après échecs
10. Supprimer la journalisation des jetons ; passer à un vrai logger
11. Validation des entrées (`zod`) sur toutes les routes ; protection CSRF
12. Rendre `lib/seed.js` idempotent et ajouter `"seed": "node lib/seed.js"` (+ `"type": "module"`)

### Phase 2 — Rendre déployable (2-3 jours)
13. Corriger les 2 erreurs ESLint et les 2 avertissements → `next build` vert
14. Migrer `middleware.js` → `proxy.ts`
15. Vrai README (installation, identifiants de démo, architecture) + `.env.example`
16. Docker + CI GitHub Actions (lint + build + tests)
17. Premiers tests automatisés : auth, RBAC, et **non-régression sur le contournement 2FA**

### Phase 3 — Produit (2-4 semaines)
18. Mot de passe oublié / changement de mot de passe, page profil + avatar
19. **Espace parents**
20. CRUD emploi du temps côté admin + vue calendrier
21. Tables `classes` / `subjects`, devoirs et dépôts, bulletins PDF
22. Centre de notifications + e-mails
23. Recherche, tri, pagination, exports CSV/Excel, journal d'audit

### Phase 4 — Passage à l'échelle
24. Accessibilité complète, responsive mobile, `error boundaries`, pages 404/500
25. Migrer de SQLite vers PostgreSQL (SQLite ne supporte pas correctement plusieurs instances en parallèle — indispensable dès que l'application sort du poste local)
26. Mise en cache, optimisations de performance

---

## Annexe — Comment j'ai testé / notes de reproductibilité

- Dépendances installées avec `npm install --ignore-scripts`, puis exécution de l'application avec `next dev` et requêtes `curl` sur chaque route (auth, RBAC, CRUD).
- **Avertissement important sur l'environnement de test :** le module natif `better-sqlite3` n'a pas pu être compilé dans ce bac à sable (`nodejs.org` et les assets binaires GitHub sont bloqués par le réseau). Pour pouvoir exécuter l'application, j'ai placé une **shim** dans `node_modules/` qui redirige l'API `better-sqlite3` vers le module `node:sqlite` intégré à Node.
  - `node_modules/` est ignoré par Git : **le dépôt n'est pas affecté**.
  - La logique testée (requêtes SQL, auth, RBAC) est identique, mais les performances et quelques comportements de bas niveau peuvent différer.
  - Sur votre machine, `npm install` fonctionne normalement (pré-binaires disponibles) — **rien à changer de ce côté**.
- Les deux bases `data/portal.db` et `school.db` étaient versionnées. Le seed ayant été rejoué pour les tests, j'ai profité de l'occasion pour nettoyer : les bases sont maintenant ignorées par Git, dé-tracées, et le trio `school.db*` obsolète a été supprimé. Une base fraîchement seedée est en place pour la démo.
- Identifiants de démo (`lib/seed.js`) : `admin / admin123` · `teacher1 / teacher123` · `alice / student123`
  (⚠️ admin et enseignant sont bloqués par le bug 3.1 — seul `alice` fonctionne aujourd'hui.)
