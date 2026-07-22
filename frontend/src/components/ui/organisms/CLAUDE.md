# Organismes DS — `components/ui/organisms/`

`BaseChart.vue` — **seul organisme générique** du DS (les autres organismes sont
métier et vivent dans leur dossier : cards d'analyse, `../../layout/DocumentBar`,
`../../structure/StructureView`… cf. `../CLAUDE.md`).

## `BaseChart.vue` — seul point d'entrée ECharts

Les composants métier construisent l'**option** echarts, jamais le graphe.
`BaseChart` gère le reste :
- **instance** : `init`/`dispose` — echarts ne se nettoie pas au retrait du DOM.
- **`ResizeObserver`** : echarts mesure son conteneur à l'init et ne se réajuste
  jamais seul.
- **Import modulaire OBLIGATOIRE** : `echarts/core` + les seuls modules utilisés
  (`echarts.use([...])` **ici et seulement ici**). Un
  `import * as echarts from 'echarts'` embarque tous les types (~1 Mo). Ajouter le
  module d'un nouveau type de graphe à cet endroit.
- Les couleurs passées en option sont des tokens **résolus** via
  `../../../script/theme.js` (`cssVar`) — cf. `../../analyse/CLAUDE.md` pour la
  sémantique rampe/catégoriel et le piège de vérification rAF.
