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
  `cloudLayout`). Prop **`category`** : catégorie IMPOSÉE par l'hôte — le nuage
  n'en montre qu'une et perd ses chips (la navigation appartient alors à l'hôte).
  C'est le régime de la scène de recherche de la maquette ; le dashboard et le
  volet de la doc-bar gardent les filtres cumulables.
- **`MiniCloud`** — nuage d'UN type (personnages, lieux, verbes, adjectifs…),
  ~20 mots, monté par la scène de recherche à côté du grand nuage. Il est la
  NAVIGATION : le mini entier est un bouton qui promeut son type en grand nuage
  (et le type promu quitte la liste des minis, celui qu'il remplace y revient à sa
  place) — d'où des mots inertes, la sélection d'un mot restant au grand nuage.
  Option `static` d'`useWordCloud` (placement seul, aucune simulation de force) —
  autant de `d3-force` que de minis tourneraient sinon à côté de celle du grand.
- `LexicalFields`, `BridgeWords`, `LexicalUnitsCard`, `OccurrencesCard` complètent
  la famille.
