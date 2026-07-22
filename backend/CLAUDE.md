# Scribe — backend

API NestJS avec persistance PostgreSQL (Prisma). Rôle : registre de documents
(import `.odt`, consultation, analyses) qui remplace progressivement le
middleware Vite servant `structure.json`/`data.json`/`trame.json` en statique
depuis le dossier parent `Marvarid` (voir `../CLAUDE.md`) — les deux chemins
coexistent, ne pas retirer le middleware Vite sans en parler.

## Modules — carte (docs chargés à la demande)

- **`src/prisma/`** — `PrismaModule`/`PrismaService`, client Prisma en global
  provider. Modèle de données : `prisma/CLAUDE.md`.
- **`src/import/odt-parser/`** — le parseur `.odt` (héritage des styles,
  surlignages, inventaire, ventilation par zone, apparence visuelle, suggestion
  des bornes de calibration). Voir `src/import/odt-parser/CLAUDE.md`.
- **`src/documents/`** — registre, flux d'import en deux temps, typologie, règles,
  recalibration, validation. Voir `src/documents/CLAUDE.md`.
- **`src/analyse/`** — analyses par document (lexical, sémantique, thèmes BERTopic,
  complétude, conformité). Voir `src/analyse/CLAUDE.md`.

Le pipeline NLP lui-même (Python FastAPI, sans état) est décrit dans
`../CLAUDE.md` (`nlp-service/`).

## Infra locale

- PostgreSQL via Docker : `docker-compose.yml` à la racine du repo. Démarrer avec
  `docker compose up -d` (nécessite Docker Desktop lancé).
- `backend/.env` (gitignored) — copier `backend/.env.example` (`DATABASE_URL`).
- Migrations : `npm run prisma:migrate --workspace backend` (ou depuis `backend/`
  : `npx prisma migrate dev`). `npm run prisma:generate` après toute modif de
  `schema.prisma` sans nouvelle migration. Prisma épinglé en v6 (cf.
  `prisma/CLAUDE.md`).

## Commandes

Depuis `backend/` :
```
npm run start:dev        # Nest en mode watch
npm run build            # compile en dist/
npm run start:prod       # lance le build compilé
npm run prisma:generate  # régénère le client Prisma
npm run prisma:migrate   # crée + applique une migration
```
Depuis la racine : `npm run dev` (frontend + backend via `concurrently`) ou
`npm run start:dev --workspace backend` pour le backend seul. Penser à
`docker compose up -d` avant si Postgres n'est pas up.

## Conventions de code

- Conventions Nest standard (modules/controllers/services, injection de
  dépendances). Un module par domaine métier au fur et à mesure — ne pas préparer
  de structure pour des domaines qui n'existent pas encore.
- Tests `*.spec.ts` colocalisés, sur les modules à logique pure. **Aucun ne
  charge un vrai `.odt`** — un parse du vrai fichier reste le seul juge (cf.
  `src/import/odt-parser/CLAUDE.md`).
