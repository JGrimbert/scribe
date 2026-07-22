# Molécules — `components/ui/molecules/`

Compositions d'atomes (cf. `../atoms/CLAUDE.md`). `UiCard`, `UiTable`, `ChipGroup`,
`TreeRow`, `UiNote`, `StatItem`, `ProgressChecklist`. Chaque composant a sa story
colocalisée.

- **`UiTable`** porte le défilement via `../atoms/CustomScrollbar` (jamais de barre
  native) — et en dernier recours seulement : le DS préfère tronquer les listes à
  imbriquer des scrollbars.
- **`UiNote`** compose `../atoms/UiCallout` ; **`StatItem`** compose `../atoms/UiHint` ;
  **`ProgressChecklist`** compose `../atoms/UiCallout` + `../atoms/ScoreBar` — d'où
  leur rang de molécule (une primitive qui en compose une autre monte d'un cran).
- **`ProgressChecklist`** — checklist de progression d'analyse, montée dans la
  topbar `../../layout/DocumentBar.vue`.
