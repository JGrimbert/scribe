# Routing — `router/`

`App.vue` est un shell (menu + `<router-view>`), plus de toggle manuel entre
vues. Routes (`index.js`, `vue-router`) :

- **`/` — `HomeView.vue`** : porte d'entrée. La liste des manuscrits
  (`DocumentList`) + le bouton d'import, centrés. **Pas de redirection** vers le
  dernier document : `/` reste une destination réelle (icône « Accueil »).
- **`/import` — `ImportView.vue`** : `ImportCalibration` en plein écran, hors
  `DocumentLayout` (aucun document, rien à mettre dans une aside). **Garde de
  route** (`beforeEnter`) : le preview ne vit qu'en mémoire des deux côtés
  (`useRegistry`, et la `Map` du backend) — entrer par l'URL ou recharger renvoie
  à l'accueil plutôt qu'un écran mort. Le commit navigue vers la config du
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
