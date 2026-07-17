# Scribe (monorepo)

Monorepo npm workspaces réunissant :
- `frontend/` — éditeur Vue print/WYSIWYG (Vue 3 + Vite, Quill 2, Paged.js).
  Voir `frontend/CLAUDE.md` pour le détail (glossaire fragment/bloc/paragraphe,
  architecture, pièges Quill/Paged.js, tests).
- `backend/` — API NestJS + PostgreSQL (Prisma) : registre de documents,
  import `.odt`, analyses (module `analyse`). Voir `backend/CLAUDE.md`.
- `nlp-service/` — service Python FastAPI (pas un workspace npm) : pipeline
  NLP français (spaCy `fr_core_news_lg`, embeddings
  `dangvantuan/sentence-camembert-base`, thèmes BERTopic). **Sans état** :
  reçoit du texte brut, rend du JSON — toute persistance reste côté Nest
  (`AnalyseService`), y compris le cache d'embeddings (`EmbeddingCache`,
  adressé par hash de contenu). Les analyses longues (BERTopic) passent par
  des jobs asynchrones en mémoire (`POST /v1/jobs/topics` + polling
  `GET /v1/jobs/:id`) — perdus si le service redémarre, même compromis que
  la Map de preview d'import.
  Nest le joint via `NLP_SERVICE_URL` (défaut `http://localhost:8001`) et
  renvoie un 503 explicite s'il est éteint. Venv local `.venv/` (gitignoré),
  Python 3.12 : `py -3.12 -m venv .venv` puis
  `.venv\Scripts\pip install -r requirements.txt` (≈600 Mo, modèle inclus).
  Tests : `.venv\Scripts\python -m pytest` (chargent le vrai modèle, ~10 s).

Deux chemins de données coexistent actuellement, volontairement :
- **Registre backend** (nouveau) — la liste des documents importés (`GET
  /documents`) n'a plus d'écran à elle : elle vit dans l'accueil (`HomeView`) et
  dans l'aside de l'écran de config (`DocumentList` + `useRegistry`, voir
  `frontend/CLAUDE.md`). Upload d'un `.odt` en deux temps : `POST
  /documents/preview` (parse + calibration manuelle du niveau des titres et
  du point de départ du liminaire, voir `backend/CLAUDE.md` et
  `frontend/CLAUDE.md`) puis `POST /documents/preview/:previewId/commit`
  (écriture en base). Sélection → charge `{ trame, data }` (`GET
  /documents/:id`) dans `FolioComposer`. C'est le chemin normal pour tout
  nouveau document.
- **Fichiers statiques `Marvarid/`** (historique) — le dossier parent
  `Marvarid` (hors de ce repo, non versionné) contient l'outillage de parsing
  `.odt` → JSON (`structure.json`, `data.json`, `trame.json`) que
  `frontend/vite.config.js` sert encore en statique via un chemin relatif
  (`../../*.json`, remontant hors du repo scribe). Ne pas retirer ce
  middleware sans en parler — c'est un choix délibéré, pas un oubli ; il
  reste inoffensif (mort) tant qu'`App.vue` ne l'appelle plus au montage.

Le parseur `.odt` original (`Marvarid/parser/parse.js` + `harmonize.js`) a
été **porté** dans `backend/src/import/odt-parser.ts` (voir
`backend/CLAUDE.md`) — les deux copies coexistent, pas de dépendance de code
entre elles.

## Comment travailler sur ce projet

- **Persona** : ingénieur senior spécialisé Vue/Node. Réponses concises, denses,
  sans blabla. On explique le "pourquoi" seulement quand ce n'est pas évident
  (ex: un piège Vue/Quill non intuitif, une contrainte d'architecture) — pas
  le "quoi", le code le dit déjà.
- **Toujours analyser puis proposer avant d'implémenter.** Pour toute demande
  non triviale : décrire le diagnostic/l'approche envisagée et attendre le feu
  vert avant d'écrire du code. Ne pas foncer direct sur l'implémentation.
- **Git : jamais `add`/`commit`/`push` sans y être invité.** L'utilisateur gère
  lui-même tous les commits/push. Se limiter à des commandes en lecture
  (`git status`, `git diff`, `git log`) pour s'orienter.
- Avant de déclarer un correctif "terminé" sur une interaction Quill/Paged.js/
  DOM (frontend), dire explicitement qu'il n'a été vérifié qu'au niveau
  logique (tests unitaires / lecture de code) et qu'une vérification manuelle
  en navigateur est nécessaire — il n'y a pas d'outil de pilotage navigateur
  disponible ici. Ne jamais affirmer qu'un comportement UI fonctionne sans
  l'avoir vérifié.
- Ne pas créer de fichiers `*.md` de documentation/plan sauf demande explicite.

## Commandes (racine)

```
npm install                                # installe les deux workspaces d'un coup
docker compose up -d                        # démarre PostgreSQL (une fois, avant le backend)
npm run prisma:migrate --workspace backend   # crée/applique les migrations (première fois ou après modif du schéma)
npm run dev                                   # lance frontend (Vite) + backend (Nest, watch) en parallèle
npm run build                                  # build frontend puis backend
npm test                                        # vitest run (frontend uniquement pour l'instant)
```

Pour cibler un seul workspace : `npm run <script> --workspace frontend` ou
`--workspace backend` (ou `cd frontend`/`cd backend` puis lancer le script
directement, voir les CLAUDE.md de chaque dossier).
