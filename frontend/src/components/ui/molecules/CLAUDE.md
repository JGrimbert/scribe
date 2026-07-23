# Molécules — `components/ui/molecules/`

Compositions d'atomes (cf. `../atoms/CLAUDE.md`). `UiCard`, `UiModal`, `UiTable`,
`ChipGroup`, `TreeRow`, `UiNote`, `StatItem`, `ProgressChecklist`. Chaque composant
a sa story colocalisée.

- **`UiModal`** — chrome de modale générique (voile clair flouté, panneau titré,
  pastille `?` optionnelle via `hint`, croix). Backdrop-clic + Échap émettent
  `close` (l'hôte détient `open`). `z-index` 200 au-dessus des barres ; `topBars`
  dégage leur hauteur (1 à l'accueil, 2 dans un document). Corps flex qui laisse un
  contenu flexible (la calibration) défiler sa seule liste. Hôtes :
  `../../import/ImportCalibrationModal.vue` (import) et
  `../../config/RecalibrationModal.vue` (recalibrage).
- **`UiTable`** porte le défilement via `../atoms/CustomScrollbar` (jamais de barre
  native) — et en dernier recours seulement : le DS préfère tronquer les listes à
  imbriquer des scrollbars.
- **`UiNote`** compose `../atoms/UiCallout` ; **`StatItem`** compose `../atoms/UiHint` ;
  **`ProgressChecklist`** compose `../atoms/UiCallout` + `../atoms/ScoreBar` — d'où
  leur rang de molécule (une primitive qui en compose une autre monte d'un cran).
- **`ProgressChecklist`** — checklist de progression d'analyse, montée dans la
  topbar `../../layout/DocumentBar.vue`.
