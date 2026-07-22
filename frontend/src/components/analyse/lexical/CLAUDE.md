# Cards lexical — `components/analyse/lexical/`

Champ lexical du document. Cadre commun `AnalyseBlock` + store `useAnalyse` : cf.
`../CLAUDE.md`. Helpers purs : `../../../script/` (`graphMetrics`, `cloudLayout`…).

- **`LexicalCard`** (bloc orchestrateur) importe `LexicalFields`, `BridgeWords`,
  `LexicalGraph` locaux + `../semantic/NodeInspector`.
- **`LexicalGraph`** — réseau lexical (`useLexicalGraph` + `graphMetrics`) ; les
  communautés prennent la palette **catégorielle** `--c-cat-*` (identité, ordre
  arbitraire), cf. « couleurs » dans `../CLAUDE.md`.
- **`VocabulaireCard`** (bloc) importe `VocabulaireCloud`, `OccurrencesCard` locaux
  + `../semantic/SemantiqueCard`.
- **`VocabulaireCloud`** — nuage de lemmes (`useWordCloud`/`useCloudFilters` +
  `cloudLayout`). `LexicalFields`, `BridgeWords`, `LexicalUnitsCard`,
  `OccurrencesCard` complètent la famille.
