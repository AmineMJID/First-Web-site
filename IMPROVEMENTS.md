# ✅ Améliorations Implémentées - Meilleur Portail Étudiant

Ce document liste toutes les corrections demandées et implémentées.

## 1. 🔒 Rate-limit persistant (fix mémoire)

**Problème avant:** `Map()` en mémoire, reset à chaque restart, ne marche pas en multi-instances.

**Solution:**
- Nouvelle table `rate_limits` (key, created_at) avec index
- `lib/rateLimit.js`: checkRateLimit() avec DB + fallback mémoire LRU
- Configs différenciées: `login` (10/15min), `api` (100/min), `create` (20/min), `message` (30/min)
- Nettoyage automatique probabiliste des anciennes entrées
- Utilisé dans `/api/auth/login`, `/api/students`, `/api/teachers`, `/api/messages`
- Retour 429 avec `retryAfter` pour UX

## 2. 🛡️ CSRF + XSS Protection

**Problème avant:** Pas de CSRF, messages rendus potentiellement en HTML.

**Solution CSRF:**
- `lib/csrf.js`: double-submit cookie + vérification Origin/Referer
- `proxy.js`: vérifie Origin pour POST/PUT/DELETE sur /api/*, bloque si mismatch (autorise localhost et *.e2b.app pour previews)
- Cookies `SameSite` strict

**Solution XSS:**
- `lib/sanitize.js`: 
  - `stripHtml()`, `escapeHtml()`
  - `sanitizeMessageBody()`: supprime <script>, <iframe>, on*=, javascript:, data:text/html
  - `sanitizeSubject()`: texte pur seulement
  - `sanitizeText()` pour noms, etc.
- Utilisé dans `/api/messages` et tous les POST/PUT
- Headers sécurité dans `proxy.js` et `lib/api.js`: 
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection`
  - `CSP` restrictive
  - `Referrer-Policy`, `Permissions-Policy`

## 3. ✅ Validation forte avec Zod

**Problème avant:** `clampStr` maison, pas de limite payload.

**Solution:**
- `lib/validators.js` avec Zod schemas complets:
  - `studentCreateSchema`, `teacherCreateSchema`, `gradeSchema`, `attendanceRecordSchema`, `messageCreateSchema`, `scheduleCreateSchema`, `loginSchema`, `changePasswordSchema`, `paginationSchema`
- `validate()` helper qui retourne erreur claire
- `lib/api.js`: `readJson()` avec limite 1MB + `checkPayloadSize()`
- Toutes les routes API utilisent maintenant Zod, retour 400 avec message précis
- Installation `zod` via npm

## 4. 📋 Audit Log

**Problème avant:** Impossible de savoir qui a supprimé un élève ou modifié une note.

**Solution:**
- Nouvelle table `audit_logs` (user_id, action, entity_type, entity_id, details, ip, user_agent, created_at)
- `lib/audit.js`: `logAudit()` avec scrubbing des champs sensibles (password, secret, token => [REDACTED])
- `AUDIT_ACTIONS` enum: login, login_failed, logout, create, update, delete, reset_password, grade_upsert, attendance_record, message_send, etc.
- Utilisé dans: login, create/update/delete student/teacher, reset password, grade upsert, attendance, message send/delete, schedule create/update/delete
- Nouvelle route `GET /api/audit` (admin only) avec pagination + filtres action/entityType/userId
- Jamais log de mot de passe en clair

## 5. 🔑 Mot de passe temporaire sécurisé

**Problème avant:** Affiché en clair dans modal, loggé potentiellement, hash 10.

**Solution:**
- `lib/auth.js`: bcrypt cost 10 → 12
- `lib/api.js` et routes: `console.error` ne log que `e.message`, jamais password
- `components/PasswordReveal.js`: 
  - Flouté par défaut (blur), bouton Eye pour révéler
  - Warning "Copiez maintenant, affiché une seule fois"
  - Bouton copier username+password
  - Hint "devra changer à première connexion"
- API retourne `_warning` + password une seule fois
- Soft-delete garde trace, pas de suppression hard immédiate

## 6. 🗄️ Base de données - Abstraction + Migrations + Soft-delete

**Problème avant:** SQLite WAL ok dev mais pas prod, pas de trigger, pas de migration, portal.db commité.

**Solution DB:**
- `lib/db.js` refondu:
  - `PRAGMA busy_timeout = 5000` pour concurrence
  - Table `schema_migrations` versionnée
  - Migrations avec triggers `updated_at` automatiques pour toutes les tables (users, students, teachers, grades, attendance, messages, schedules)
  - Colonnes `deleted_at`, `created_at`, `updated_at` partout
  - Tables `audit_logs`, `rate_limits` avec index
  - `notDeleted()` helper pour filtrer soft-deleted
  - `dbProvider` abstraction: `DB_TYPE` env pour futur Postgres
  - Migrations idempotentes via `hasColumn`, `hasTable`
- Soft-delete implémenté: DELETE → UPDATE deleted_at = NOW(), pas de hard delete
  - Routes students, teachers, grades, attendance, messages, schedules utilisent soft-delete
  - `notDeleted()` partout dans les SELECT
- `data/portal.db` retiré de git: `git rm --cached`, `.gitignore` déjà avec `/data/` et `*.db*`
- `.env.example` créé avec JWT_SECRET obligatoire

## 7. 🎨 Code - Design System + Fin des styles inline

**Problème avant:** 90% `style={{...}}` inline, impossible à maintenir.

**Solution:**
- `app/globals.css` enrichi avec classes utilitaires:
  - `.filters-card`, `.search-box`, `.search-input`, `.avatar`, `.avatar-lg`, `.icon-btn`, `.icon-btn-danger`
  - `.stats-grid`, `.stat-card`, `.stat-top`, `.content-grid`, `.section-header`, `.section-title`
  - `.card-hover`, `.card-header/body/footer`, `.table-actions`, `.table-empty`
  - `.security-badge`, `.btn-secondary`, `.btn-ghost`, `.btn-lg`
  - Skeleton, Pagination, PasswordReveal styles
- `components/ui/Button.js`, `components/ui/Card.js` (design system)
- `app/dashboard/admin/students/page.js` refondu:
  - Utilise classes CSS au lieu de `style={{}}`
  - `flex`, `gap-2`, `filters-card`, `search-box`, `avatar`, `icon-btn`, `table-actions`
  - Pagination UI
  - SkeletonTable
  - ErrorBoundary
  - PasswordReveal sécurisé
  - Badge "Soft-delete + Audit Log + Pagination"

## 8. 📄 Pagination

**Problème avant:** `/api/students` renvoie tout, crash à 2000 élèves.

**Solution:**
- `lib/api.js`: `parsePagination()` (page, limit max 100, offset, search, sortBy, sortOrder) + `paginatedResponse()` avec total, totalPages, hasNext/Prev
- Toutes les routes GET supportent pagination si `?page&limit` présent, sinon backward compat array:
  - students, teachers, grades, attendance, schedule, messages, audit
- `components/Pagination.js`: UI avec ellipsis, prev/next, info total
- `lib/client.js`: `unwrapPaginated()` helper + gestion 429
- Admin students page: page state + Pagination component, 20 par page, debounce search 300ms

## 9. 💀 Skeleton + ErrorBoundary

**Problème avant:** Pas de loading skeleton, pas de ErrorBoundary.

**Solution:**
- `components/Skeleton.js`: 
  - `Skeleton` base avec shimmer animation
  - `SkeletonTable` (rows/cols), `SkeletonCard`, `SkeletonStats`
- `components/ErrorBoundary.js`: 
  - Class component avec `getDerivedStateFromError`, `componentDidCatch`
  - UI avec AlertTriangle, détails techniques en dev, boutons Retry/Home
  - `ErrorFallback` pour usage inline
- `app/dashboard/layout.js`:
  - Loading initial avec `SkeletonStats`
  - Children wrappés dans `<ErrorBoundary>`
- `app/dashboard/admin/students/page.js`: `SkeletonTable` pendant loading

## 10. 🔄 Proxy + Refresh Token

**Problème avant:** Session 24h fixe, pas de refresh.

**Solution `proxy.js`:**
- Access token 24h + Refresh token 7 jours
- Sliding window: si <2h restantes, auto-refresh
- Try refresh token si access expiré
- `attachRefreshedTokens()` génère nouveaux tokens + set cookies
- Security headers: CSP, X-Frame-Options, etc.
- Origin check pour API state-changing
- `lib/auth.js`:
  - `signRefreshToken()`, `refreshCookieOptions()`, `shouldRefreshToken()`
  - bcrypt cost 12, secret length check en prod
  - `REFRESH_COOKIE_NAME`, `SLIDING_WINDOW_HOURS`
- `/api/auth/logout`: supprime auth + refresh + csrf
- `/api/auth/login`: set auth + refresh cookies
- `/api/auth/verify-2fa`: set auth + refresh

## 📊 Résumé fichiers modifiés/créés

**Nouveaux:**
- lib/validators.js (Zod)
- lib/sanitize.js (XSS)
- lib/audit.js (audit log)
- lib/rateLimit.js (persistent)
- lib/csrf.js
- app/api/audit/route.js
- components/Skeleton.js
- components/ErrorBoundary.js
- components/Pagination.js
- components/PasswordReveal.js
- components/ui/Button.js, Card.js
- .env.example
- IMPROVEMENTS.md

**Modifiés (sécurité + pagination + soft-delete):**
- lib/db.js (migrations, triggers, soft-delete, audit_logs, rate_limits)
- lib/api.js (payload limit, pagination, security headers)
- lib/auth.js (refresh token, bcrypt 12)
- lib/schedule.js (Zod)
- lib/client.js (429 handling)
- proxy.js (refresh, CSRF, CSP)
- app/api/auth/login, logout, change-password, verify-2fa, me
- app/api/students, [id], teachers, [id], grades, attendance, messages, [id], schedule, [id]
- app/dashboard/layout.js (ErrorBoundary + Skeleton)
- app/dashboard/admin/students/page.js (refactor design system + pagination + secure password)
- app/globals.css (design system + skeleton + pagination)
- .gitignore déjà ok, mais db retiré de l'index

## 🚀 Comment tester

```bash
npm install
cp .env.example .env.local # mettre JWT_SECRET long
npm run dev
# Test pagination: /api/students?page=1&limit=5
# Test rate-limit: 11 logins rapides → 429
# Test XSS: envoyer <script>alert(1)</script> en message → doit être strippé
# Test audit: /api/audit (admin) → voir logs
# Test soft-delete: supprimer étudiant → plus dans liste mais dans DB avec deleted_at
# Test refresh: attendre 22h (ou modifier SLIDING_WINDOW) → token auto-refresh
```

## 🔜 Prochaines étapes recommandées (non faites ici)

- Passer à Postgres + Prisma pour prod scale
- Tailwind CSS complet pour supprimer 100% inline styles restants
- PWA + offline
- Tests E2E avec nouveau système
- Sentry pour logs d'erreurs
- Upload fichiers avec antivirus scan
