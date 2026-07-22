# Composants — `components/`

Tout est en sous-dossiers thématiques ; chaque sous-arbre porte son `CLAUDE.md`,
chargé à la demande (ne toucher qu'une famille n'en charge que le doc). Carte :

- **`editor/`** — rendu paginé + édition : `FolioView` (UNIQUE éditeur, Paged.js
  en iframe), `EditorView`, `QuillBlock`, `ArticlePickerModal`. Voir `editor/CLAUDE.md`.
- **`import/`** — import `.odt` : `ImportView`, `ImportButton`, `ImportCalibration`,
  `CalibrationNode` (calibration + recalibration). Voir `import/CLAUDE.md`.
- **`structure/`** — aside arborescente du document : `StructureView` /
  `StructureNode`. Voir `structure/CLAUDE.md`.
- **`layout/`** — coquille d'un document ouvert : `DocumentLayout` (asides, cycle
  trame/data) + `DocumentBar` (2e topbar, fil d'Ariane, validation, scope). Voir
  `layout/CLAUDE.md`.
- **`home/`** — accueil + registre : `HomeView`, `DocumentList`. Voir `home/CLAUDE.md`.
- **`config/`** — écran de configuration (typologie, styles, modèles, règles,
  recalibration). Voir `config/CLAUDE.md`.
- **`analyse/`** — dashboard de `/documents/:id` (`AnalyseView` + cards,
  `AnalyseBlock`, echarts). Voir `analyse/CLAUDE.md`.
- **`liminaire/`** — typage/composition des pages liminaires (`LiminaireComposer`
  + accordéon/découpage/éligibilité/folio). Voir `liminaire/CLAUDE.md`.
- **`ui/`** — design system atomique + Storybook + `BaseChart`. Voir `ui/CLAUDE.md`.

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
