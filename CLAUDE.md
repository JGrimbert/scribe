# Scribe (monorepo)

Monorepo npm workspaces réunissant :
- `frontend/` — éditeur Vue print/WYSIWYG (Vue 3 + Vite, Quill 2, Paged.js).
  Voir `frontend/CLAUDE.md` pour le détail (glossaire fragment/bloc/paragraphe,
  architecture, pièges Quill/Paged.js, tests).
- `backend/` — API NestJS, tout début de chantier (scaffold minimal, pas
  encore de persistance réelle branchée). Voir `backend/CLAUDE.md`.

Le dossier parent `Marvarid` (hors de ce repo, non versionné) contient
l'outillage de parsing `.odt` → JSON (`structure.json`, `data.json`,
`trame.json`) que `frontend/vite.config.js` lit encore en statique via un
chemin relatif (`../../*.json`, remontant hors du repo scribe). C'est une
dépendance connue et assumée pour l'instant : cloner `scribe` seul ne donne
pas de données tant que le backend ne sert pas cette persistance. Ne pas
"corriger" ça sans en parler — c'est un choix délibéré, pas un oubli.

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
npm install           # installe les deux workspaces d'un coup
npm run dev            # lance frontend (Vite) + backend (Nest, watch) en parallèle
npm run build           # build frontend puis backend
npm test                 # vitest run (frontend uniquement pour l'instant)
```

Pour cibler un seul workspace : `npm run <script> --workspace frontend` ou
`--workspace backend` (ou `cd frontend`/`cd backend` puis lancer le script
directement, voir les CLAUDE.md de chaque dossier).
