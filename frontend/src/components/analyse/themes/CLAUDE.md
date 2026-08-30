# Cards thèmes — `components/analyse/themes/`

Thèmes BERTopic (job asynchrone côté backend, cf. `../../../../../backend/CLAUDE.md`).
Cadre commun `AnalyseBlock` + store `useAnalyse` : cf. `../CLAUDE.md`.

- **`ThemesCard`** (bloc orchestrateur) importe `ThemesMap`, `ThemeList`,
  `ThemeDetail` locaux.
- **`ThemesMap`** — projection UMAP 2D des documents/thèmes.
- **`ThemesFlowCard`** — « au fil du livre » : un `singleAxis` par thème, la
  position dans l'ordre de LECTURE en abscisse, la taille du point = le nombre de
  segments. Complémentaire de la carte UMAP (qui dit quels thèmes se ressemblent,
  jamais lequel ouvre le livre). Croisement pur dans `../../../script/topicFlow.js`
  (testé) — la projection porte un `nodeId`, la trame donne l'ordre.
- **`EntitiesLeftoverCard`** — entités hors thèmes ; card **de premier niveau**
  (sa propre entrée dans `ANALYSE_CARDS`, pas sous `ThemesCard`).
  `ThemeList`/`ThemeDetail` complètent.
