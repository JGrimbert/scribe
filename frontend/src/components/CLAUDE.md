# Composants — `components/`

Tout est en sous-dossiers thématiques ; chaque sous-arbre porte son `CLAUDE.md`,
chargé à la demande (ne toucher qu'une famille n'en charge que le doc). Carte :

- **`editor/`** — rendu paginé + édition : `FolioView` (UNIQUE éditeur, Paged.js
  en iframe), `EditorView`, `QuillBlock`, `ArticlePickerModal`. Voir `editor/CLAUDE.md`.
- **`import/`** — import `.odt` : `ImportButton`, `ImportCalibrationModal` (modale
  globale montée dans `App`), `ImportCalibration`, `CalibrationNode` (calibration +
  recalibration, toujours en modale). Voir `import/CLAUDE.md`.
- **`structure/`** — aside arborescente du document : `StructureView` /
  `StructureNode`. Voir `structure/CLAUDE.md`.
- **`layout/`** — coquille d'un document ouvert : `DocumentLayout` (asides, cycle
  trame/data) + `DocumentBar` (2e topbar, fil d'Ariane, validation, scope). Voir
  `layout/CLAUDE.md`.
- **`home/`** — accueil = écran de registre pleine largeur (`HomeView`, tableau
  détaillé des manuscrits ; `DocumentList` supprimé). Voir `home/CLAUDE.md`.
- **`config/`** — **plus d'écran routé** (`ConfigView` supprimé le 2026-08-05,
  fondu dans la maquette) : dossier de composants PARTAGÉS de configuration
  (typologie/styles/règles/recalibration : `StyleRolesTable`, `RecalibrationModal`,
  `RuleSetForm`, `HighlightsList`, `PageDiagram`, `StyleEditorPanel`…), consommés
  par la maquette. Voir `config/CLAUDE.md`.
- **`analyse/`** — **plus d'écran routé** (`AnalyseView` supprimé le 2026-08-30,
  ses sections absorbées par la maquette) : dossier de composants d'analyse PARTAGÉS
  (`AnalyseBlock`, echarts, cards par famille `structure/`·`lexical/`·`semantic/`·
  `themes/`) + store `useAnalyse`, consommés par la maquette et le CTA de
  `DocumentBar`. Voir `analyse/CLAUDE.md`.
- **`maquette/`** — écran Maquette : `MaquetteView` est une **coquille** (barres,
  sommaire, dock, **deux slots A/B de `FolioView`** qui glissent en ping-pong, cf.
  `useMaquetteSlide`) qui route ses **jalons** dans `maquette/panes/`
  (`MaquetteVocabulairePane` = titredulivre par défaut, `…Format`, `…Liminaire`,
  `…Chapitrage`, `…AnnotationsPane` = fragments annotés en lambeaux + panneau
  validation/anomalies). Les **callouts ancrés au folio** (format, styles liminaire/
  chapitrage, `LiminaireControls`, `BlockOutlines`) ne vivent PLUS dans les panes :
  ils sont montés DANS chaque slot par `MaquetteCallouts` (aiguillé par la SOURCE de la
  vue du slot, figée pour la sortante) → le transform du slot les fait **glisser avec
  la planche** pendant une bascule (plus d'effacement). Les panes ne gardent que le
  non-ancré (`MaquetteGroupes`, `MaquetteFragmentPreview`) ; `…Format`/`…Liminaire`
  sont désormais vides (cibles de routage). Le modèle partagé est fourni via
  `provide('maq', …)`. Routing + synchro `focused`⇄route : `../router/CLAUDE.md`.
- **`liminaire/`** — typage/composition des pages liminaires (`LiminaireControls`
  — overlay type/découpage posé sur la planche, monté par `MaquetteCallouts` dans le
  slot — + `LiminaireFolio`, montés par la maquette ; l'ancien `LiminaireComposer`/
  accordéon dédié a été supprimé). Voir `liminaire/CLAUDE.md`.
- **`ui/`** — design system en atomic design : `atoms/`, `molecules/`,
  `organisms/` (`BaseChart`) + Storybook. Voir `ui/CLAUDE.md`.

Routing et rôle de chaque vue : `../router/CLAUDE.md`. Moteur d'édition (logique
pure) : `../script/CLAUDE.md`. Composables : `../composables/CLAUDE.md`.

## Tests DOM/layout (e2e) — transverse

Playwright (`npm run test:e2e`, specs dans `../../e2e/`) couvre ce que jsdom ne
rend pas — le **layout réel** (hauteurs, débordements, échelle), à cheval sur
plusieurs familles. Backend jamais requis : `e2e/fixtures.js` mocke
`GET /api/documents/:id` et neutralise l'analyse. Specs : `pagination.spec.js`
(plancher de pages, non-débordement d'un folio → `editor/`), `scrollbar.spec.js`
(géométrie `CustomScrollbar` + non-régression de l'échelle Folio → `ui/`+`editor/`),
`sidebar.spec.js` (→ `structure/`). Pas encore de tests d'intégration DOM/Quill
(Vue Test Utils) : toute interaction clavier/souris de `FolioView`/`QuillBlock` se
vérifie **manuellement en navigateur** (cf. `../../CLAUDE.md`).
