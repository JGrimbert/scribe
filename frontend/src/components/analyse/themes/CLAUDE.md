# Cards thèmes — `components/analyse/themes/`

Thèmes BERTopic (job asynchrone côté backend, cf. `../../../../../backend/CLAUDE.md`).
Cadre commun `AnalyseBlock` + store `useAnalyse` : cf. `../CLAUDE.md`.

- **`ThemesCard`** (bloc orchestrateur) importe `ThemesMap`, `ThemeList`,
  `ThemeDetail` locaux.
- **`ThemesMap`** — projection UMAP 2D des documents/thèmes.
- **`EntitiesLeftoverCard`** — entités hors thèmes ; montée **directement par
  `AnalyseView`** (pas sous `ThemesCard`). `ThemeList`/`ThemeDetail` complètent.
