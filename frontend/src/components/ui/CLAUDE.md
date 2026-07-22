# Design system — `components/ui/`

Atomic design : les primitives réutilisables sont rangées par niveau, chacune avec
son doc (chargé à la demande). Consommées par le domaine métier (cards d'analyse,
config, vues) qui ne garde en scoped que son layout propre. Chaque composant a sa
story colocalisée (`*.stories.js`, CSF3).

- **`atoms/`** — primitives indivisibles (boutons, puces, champs, barres, notes,
  scrollbar). Voir `atoms/CLAUDE.md`.
- **`molecules/`** — compositions d'atomes (cartes, tables, groupes de puces,
  lignes d'arbre, checklist). Voir `molecules/CLAUDE.md`.
- **`organisms/`** — `BaseChart`, unique point d'entrée ECharts (seul organisme
  *générique*). Voir `organisms/CLAUDE.md`.

## Où vivent organismes / templates / pages (mapping atomic)

`ui/` ne contient que les niveaux **réutilisables** du DS. Les niveaux supérieurs
ne sont pas des primitives : ils vivent dans les dossiers métier et n'ont pas à
migrer sous `ui/` —
- **organismes** (compositions à état/domaine) : les cards du dashboard
  (`../analyse/**`), la topbar `../layout/DocumentBar.vue`, l'aside
  `../structure/StructureView.vue`, la calibration `../import/ImportCalibration.vue`,
  le composeur `../liminaire/LiminaireComposer.vue`. `BaseChart` est le seul
  organisme sans domaine, d'où sa place dans `organisms/`.
- **templates** : la coquille `../layout/DocumentLayout.vue` (asides + topbar +
  `<router-view>`).
- **pages** : les vues montées par le routeur (`../home/HomeView`,
  `../analyse/AnalyseView`, `../config/ConfigView`, `../editor/EditorView`,
  `../import/ImportView`) — le « niveau 1 » historique des dossiers, cf.
  `../../router/CLAUDE.md`.

## Tokens

`../../assets/base.css` est la source unique (couleurs, typo `--font-ui`/
`--font-serif`, échelles `--fs-*`/`--sp-*`, `--radius-*`, opacités `--op-*`). Ne
pas introduire de couleur/taille en dur — ajouter un token.

## Storybook

`@storybook/vue3-vite`, config `.storybook/`. `npm run storybook` (port 6006),
`npm run build-storybook` (smoke-test, sortie `storybook-static/` gitignorée). Le
glob des stories est **récursif** (`src/**/*.stories.js`) : ranger un composant par
niveau atomic ne casse rien côté config. `preview.js` importe primeicons +
`base.css` (mêmes tokens et fond que l'app) et installe un **routeur en mémoire** :
sans lui, tout composant consommant `useRoute()`/`RouterLink` (renvoi vers la
config, ouverture d'un chapitre) ne se monte pas. `Tokens.stories.js` (showcase des
tokens, sans composant) reste à la racine `ui/`.

## Conventions DS

- Radius discrets (tokens, 4 px max), **pas de scrollbars internes multiples**
  (tronquer les listes, `molecules/UiTable scroll` en dernier recours), transitions
  compositor-only (opacity/transform), sans-serif partout dans l'UI (`--font-serif`
  réservé au contenu du manuscrit), liseret de couleur uniquement s'il est
  sémantique (niveaux de calibration).
- **Hors périmètre** : la couche Folio/Quill (éditeur paginé,
  `../editor/FolioView.vue`) ne passe pas par `ui/` ni Storybook.
