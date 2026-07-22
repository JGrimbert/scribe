# Design system — `components/ui/`

Atomic design : atoms et molecules réutilisables, consommés par le domaine
métier (cards d'analyse, config, vues) qui ne garde en scoped que son layout
propre. Chaque composant a sa story colocalisée (`*.stories.js`, CSF3).

- **Tokens** : `../../assets/base.css` est la source unique (couleurs, typo
  `--font-ui`/`--font-serif`, échelles `--fs-*`/`--sp-*`, `--radius-*`, opacités
  `--op-*`). Ne pas introduire de couleur/taille en dur — ajouter un token.
- **Atoms** : `BaseButton`, `BaseChip`, `BaseSelect`, `ScoreBar`, `StackedBar`,
  `StatItem`, `UiNote`, `UiHint`, `UiCallout`, `ProgressChecklist`.
  **Molecules** : `UiCard`, `UiTable`, `ChipGroup`, `TreeRow`.
- **`ScoreBar` vs `StackedBar`** : `ScoreBar` montre UNE valeur sur une échelle
  (une progression) ; `StackedBar` montre la **répartition** d'un total entre
  catégories — il ne sait pas ce qu'il peint, les couleurs viennent de
  l'appelant, parce que le choix rampe ordinale vs palette catégorielle se décide
  dans le domaine métier (voir « couleurs » dans `../analyse/CLAUDE.md`).

## Storybook

`@storybook/vue3-vite`, config `.storybook/`. `npm run storybook` (port 6006),
`npm run build-storybook` (smoke-test, sortie `storybook-static/` gitignorée).
`preview.js` importe primeicons + `base.css` (mêmes tokens et fond que l'app) et
installe un **routeur en mémoire** : sans lui, tout composant consommant
`useRoute()`/`RouterLink` (renvoi vers la config, ouverture d'un chapitre) ne se
monte pas.

## Conventions DS

- Radius discrets (tokens, 4 px max), **pas de scrollbars internes multiples**
  (tronquer les listes, `UiTable scroll` en dernier recours), transitions
  compositor-only (opacity/transform), sans-serif partout dans l'UI
  (`--font-serif` réservé au contenu du manuscrit), liseret de couleur uniquement
  s'il est sémantique (niveaux de calibration).
- **Hors périmètre** : la couche Folio/Quill (éditeur paginé, `../editor/FolioView.vue`)
  ne passe pas par `ui/` ni Storybook.

## `BaseChart.vue` — seul point d'entrée ECharts

Les composants métier construisent l'**option** echarts, jamais le graphe.
`BaseChart` gère le reste :
- **instance** : `init`/`dispose` — echarts ne se nettoie pas au retrait du DOM.
- **`ResizeObserver`** : echarts mesure son conteneur à l'init et ne se réajuste
  jamais seul.
- **Import modulaire OBLIGATOIRE** : `echarts/core` + les seuls modules utilisés
  (`echarts.use([...])` **ici et seulement ici**). Un
  `import * as echarts from 'echarts'` embarque tous les types (~1 Mo). Ajouter
  le module d'un nouveau type de graphe à cet endroit.
- Les couleurs passées en option sont des tokens **résolus** via
  `../../script/theme.js` (`cssVar`) — cf. `../analyse/CLAUDE.md` pour la
  sémantique rampe/catégoriel et le piège de vérification rAF.
