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
  déclenchable depuis l'accueil. Le preview ne vit qu'en mémoire des deux côtés
  (module + `Map` backend) ; un rechargement le perd et la modale se referme
  d'elle-même. Le commit navigue vers la **maquette** du document créé.
- **`/documents/:id` — `DocumentLayout.vue`** : fetch unique de
  `GET /api/documents/:id`, fournit `trame`/`data` via `provide`/`inject` aux
  routes enfants, monte `DocumentBar` + l'aside (registre XOR `StructureView`
  selon `asideMode`). Détient l'état de validation et le scope d'analyse (cf.
  `../components/CLAUDE.md`, « Menus »). Enfants :
  - **`''` — `MaquetteView.vue` (COQUILLE) + jalons routés en enfants** : la vue
    par défaut du document. `MaquetteView` garde barres, sommaire, dock et l'**unique
    `FolioView` persistant** (jamais démonté d'un jalon à l'autre), et route ses
    **jalons** dans un `<router-view>` (couche par-dessus le folio, dans `.folio-col`).
    Enfants (`components/maquette/panes/`) :
    - **`''` (`maquette`) — `MaquetteVocabulairePane`** : jalon de tête
      « titredulivre » (vocabulaire/recherche). **Route par défaut, hors URL et hors
      fil d'Ariane.** Garde le name `maquette` → tous les `{name:'maquette'}` /
      `/documents/:id` existants y atterrissent.
    - **`Format` (`maquette-format`) — `MaquetteFormatPane`** : callouts de format.
    - **`Liminaire/:n?` (`maquette-liminaire`) — `MaquetteLiminairePane`** : `n` =
      index de planche (1-based). Contrôles + callouts de styles liminaire.
    - **`Chapitrage/:n?` (`maquette-chapitrage`) — `MaquetteChapitragePane`** : `n` =
      niveau de chapitrage (1-based). Callouts « exigé » + volet des familles (validation).
    - **`Annotations` (`maquette-annotations`) — `MaquetteAnnotationsPane`** : le folio
      coule les **fragments annotés** en lambeaux (passages surlignés typés
      `annotation`, réutilise la scène de recherche : `pouring` = `searching` ∪
      `validation`). Le pane pose EN REGARD le panneau de validation
      (`MaquetteAnnotations` : avancement · seuil · chapitres en attente, ex-jalon
      Anomalies fondu ici) et, en tête des lambeaux, le menu de filtres
      (`MaquetteAnnotationFilters`, ex-« Surlignages »). Plus de `<router-view
      name="aside">` (l'ancienne aside `MaquetteAnnotationsAside`/`MaquetteAside` est
      supprimée).
    - **Synchro `focused` ⇄ route** : `focused` (index de cran) reste la SoT interne
      du dock/sommaire/calques d'analyse ; la route ne pin que le JALON (+ planche/
      niveau). Deux watches gardés (flag anti-boucle) dans `MaquetteView` ;
      `router.replace` (la molette ne pollue pas l'historique). Naviguer entre les
      calques de titredulivre ne touche pas l'URL (défaut). Le modèle partagé est
      fourni aux panes via `provide('maq', {...})` — le folio reste dans la coquille.
    - **Famille de routes** : `DocumentLayout`/`DocumentBar`/`App.vue` testent
      `route.name?.startsWith('maquette')` (aside gauche masquée, libellé « Maquette »,
      champ de recherche cédé au sommaire flottant).
  - **`analyse` (`document`) — `AnalyseView.vue`** : dashboard d'analyse (grille
    de cards). Voir `../components/analyse/CLAUDE.md`. Le name reste `document`
    (scope d'analyse, labels…). **Plus aucune icône du menu n'y mène** — la route
    subsiste mais on n'y accède qu'en tapant l'URL (choix délibéré).
  - **`config` et `styles` — REDIRIGENT vers `maquette`.** L'écran de config
    (`ConfigView.vue`) a été **supprimé** (2026-08-05) : styles, règles,
    surlignages, recalibrage vivent désormais dans la maquette (aside + MaquetteBar).
    Les deux chemins restent des redirections (liens posés : dashboard, favoris,
    ancien `/config`, ancien `/styles`). Le dossier `../components/config/` **existe
    encore** (composants partagés : `StyleRolesTable`, `RecalibrationModal`,
    `PageDiagram`, `RuleSetForm`, `HighlightsList`, `StyleEditorPanel`…), mais plus
    de page routée.
  - **`noeud/:nodeId?` (`editor`) — `EditorView.vue`** → `FolioView` en édition.
    `:nodeId` **OPTIONNEL** : le menu doit pouvoir ouvrir l'éditeur sans savoir
    sur quel chapitre (il n'a pas la trame) ; sans chapitre, `EditorView` retombe
    sur le premier du livre.

`/api` est proxifié vers le backend Nest par `vite.config.js` (`server.proxy`) —
dev uniquement. Le proxy vise le **port 3000** (le backend, pas Vite en 5173) :
la confusion fait chercher un frontend là où répond Nest.
