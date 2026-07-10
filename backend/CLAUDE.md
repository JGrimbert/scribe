# Scribe — backend

API NestJS avec persistance PostgreSQL (Prisma). Rôle : registre de documents
(import `.odt`, consultation) qui remplace progressivement le middleware Vite
servant `structure.json`/`data.json`/`trame.json` en statique depuis le dossier
parent `Marvarid` (voir `../CLAUDE.md`) — les deux chemins coexistent pour
l'instant, ne pas retirer le middleware Vite sans en parler.

## Modules

- `src/prisma/` — `PrismaModule`/`PrismaService`, client Prisma exposé en
  global provider.
- `src/import/odt-parser.ts` — port fidèle de `Marvarid/parser/parse.js` +
  `harmonize.js` : lecture d'un `.odt` (ZIP + XML OpenDocument) depuis un
  `Buffer` en mémoire (upload multipart), aucune écriture disque. Vérifié par
  diff bit-à-bit contre le parseur JS original sur un manuscrit réel — même
  algorithme, mêmes règles de détection de titres/styles. Le fichier original
  (`Marvarid/parser/`, hors repo) reste la référence : toute évolution du
  parseur doit être reportée ici manuellement, il n'y a pas de dépendance de
  code entre les deux.
- `src/documents/` — `DocumentsModule` : le registre.
  - `POST /documents/upload` — upload multipart d'un `.odt` (champ `file`),
    parse + persiste (`Document` + `Node`s + `Paragraph`s) en une transaction.
  - `GET /documents` — liste des documents avec stats agrégées (axes/blocs/
    articles/mots/caractères), pour le tableau du registre côté frontend.
  - `GET /documents/:id` — reconstruit `{ trame, data }` depuis la DB, à la
    forme historique de `trame.json`/`data.json` (uniquement le sous-ensemble
    réellement consommé par `FolioComposer` — `meta`/`preambule` ne sont pas
    reconstruits, cf. `documents/dto.ts`).

## Modèle de données (`prisma/schema.prisma`)

- `Document` — un livre importé ; stats agrégées mises en cache à l'import
  (`totalMots`, `totalCaracteres`, etc.) plutôt que recalculées à la volée.
- `Node` — axe / bloc / article (`type` enum). `parentId` + `position`
  explicites (colonnes, pas un index de tableau JSON) : réordonner un
  chapitre est un `UPDATE`, pas une réécriture de blob. `id` réutilise l'UUID
  généré par `harmonize()` au moment du parse.
- `Paragraph` — un paragraphe de texte, rattaché à un `Node`, `position`
  explicite (même logique que ci-dessus).

Pas encore de versioning bloc par bloc — prévu plus tard. L'architecture
(ids stables, `position` en colonne) est pensée pour l'accueillir sans
migration lourde, mais rien n'est branché aujourd'hui.

Prisma est épinglé en v6 (`prisma`/`@prisma/client` en `^6.19.3`) : la v7
change la configuration datasource (adapters obligatoires, `url` dans le
schema n'est plus supporté pour Migrate) — pas encore adopté ici, à
reconsidérer consciemment plus tard, pas par un `npm update` distrait.

## Infra locale

- PostgreSQL via Docker : `docker-compose.yml` à la racine du repo. Démarrer
  avec `docker compose up -d` (nécessite Docker Desktop lancé).
- `backend/.env` (gitignored) — copier `backend/.env.example` (`DATABASE_URL`).
- Migrations : `npm run prisma:migrate --workspace backend` (ou depuis
  `backend/` : `npx prisma migrate dev`). `npm run prisma:generate` après
  toute modif de `schema.prisma` sans nouvelle migration.

## Commandes

Depuis `backend/` :
```
npm run start:dev        # Nest en mode watch
npm run build             # compile en dist/
npm run start:prod         # lance le build compilé
npm run prisma:generate    # régénère le client Prisma
npm run prisma:migrate     # crée + applique une migration
```
Depuis la racine : `npm run dev` (lance frontend + backend ensemble via
`concurrently`) ou `npm run start:dev --workspace backend` pour le backend
seul. Penser à `docker compose up -d` avant si Postgres n'est pas déjà up.

## Conventions de code

- Suivre les conventions Nest standard (modules/controllers/services,
  injection de dépendances). Un module par domaine métier au fur et à mesure
  qu'ils apparaissent — ne pas préparer de structure pour des domaines qui
  n'existent pas encore.
