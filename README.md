# Scribe

Éditeur print/WYSIWYG pour manuscrits longs (axes → blocs → articles →
paragraphes), avec import depuis `.odt` et pagination façon livre imprimé.

Monorepo npm workspaces : `frontend/` (édition) + `backend/` (API, registre
de documents).

## Stack

- **Frontend** — Vue 3 (`<script setup>`), Vite, Quill 2, Paged.js, PrimeIcons
- **Backend** — NestJS, Prisma, PostgreSQL
- **Import `.odt`** — unzipper, xmldom, xpath (lecture ZIP + XML OpenDocument)

## Prérequis

- Node.js 20+, npm
- Docker Desktop (pour PostgreSQL)

## Installation

```bash
npm install
docker compose up -d                          # démarre PostgreSQL
cp backend/.env.example backend/.env
npm run prisma:migrate --workspace backend      # crée les tables
```

## Lancer

```bash
npm run dev
```

- Frontend : http://localhost:5173
- Backend : http://localhost:3000

## Tests

Frontend : Vitest + jsdom (logique pure `src/script/`, sans dépendance
DOM/Quill/Paged.js réelle). Backend : pas encore de suite de tests.

```bash
npm test                       # vitest run (frontend)
npm run test:watch --workspace frontend
```

## Autres commandes

```bash
npm run build                              # build frontend puis backend
npm run <script> --workspace frontend        # cibler un seul workspace
npm run <script> --workspace backend
```

## Structure

- `frontend/` — éditeur (détails : `frontend/CLAUDE.md`)
- `backend/` — API + persistance (détails : `backend/CLAUDE.md`)
