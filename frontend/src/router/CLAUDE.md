# Routing — `router/`

`App.vue` est un shell (menu + `<router-view>`), plus de toggle manuel entre
vues. Routes (`index.js`, `vue-router`) :

- **`/` — `HomeView.vue`** : porte d'entrée, à **deux colonnes comme la config**
  (aside registre `DocumentList` + import ; main = module utilisateur placeholder
  puis présentation des espaces). **Pas de redirection** vers le dernier document :
  `/` reste une destination réelle (icône « Accueil »).
- **Import : plus de route ni d'écran dédiés.** La calibration d'import passe par
  une **modale globale** (`../components/import/ImportCalibrationModal.vue`, montée
  une fois dans `App.vue`), pilotée par `pendingPreview` (`useRegistry`) —
  déclenchable depuis l'accueil comme depuis l'aside de config. Le preview ne vit
  qu'en mémoire des deux côtés (module + `Map` backend) ; un rechargement le perd
  et la modale se referme d'elle-même. Le commit navigue vers la config du
  document créé.
- **`/documents/:id` — `DocumentLayout.vue`** : fetch unique de
  `GET /api/documents/:id`, fournit `trame`/`data` via `provide`/`inject` aux
  routes enfants, monte `DocumentBar` + l'aside (registre XOR `StructureView`
  selon `asideMode`). Détient l'état de validation et le scope d'analyse (cf.
  `../components/CLAUDE.md`, « Menus »). Enfants :
  - **`''` (`document`) — `AnalyseView.vue`** : dashboard d'analyse (grille de
    cards). Voir `../components/analyse/CLAUDE.md`.
  - **`config` — `ConfigView.vue`** (`../components/config/`) : la configuration,
    **un seul écran** par typologie de contenu. Voir `../components/config/CLAUDE.md`.
    **`styles` redirige ici** (l'ancien écran de typologie a fondu dans la config ;
    les liens posés visent encore `/styles`).
  - **`noeud/:nodeId?` (`editor`) — `EditorView.vue`** → `FolioView` en édition.
    `:nodeId` **OPTIONNEL** : le menu doit pouvoir ouvrir l'éditeur sans savoir
    sur quel chapitre (il n'a pas la trame) ; sans chapitre, `EditorView` retombe
    sur le premier du livre.

`/api` est proxifié vers le backend Nest par `vite.config.js` (`server.proxy`) —
dev uniquement. Le proxy vise le **port 3000** (le backend, pas Vite en 5173) :
la confusion fait chercher un frontend là où répond Nest.
