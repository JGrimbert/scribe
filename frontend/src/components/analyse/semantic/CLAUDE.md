# Cards sémantique — `components/analyse/semantic/`

Proximité sémantique (embeddings). `SemanticCard`/`SemantiqueCard`,
`SemanticPairsCard` (`semanticPairs`, dans `../../../script/`), `NodeInspector`.
Cadre commun `AnalyseBlock` + store `useAnalyse` : cf. `../CLAUDE.md`.

Plusieurs cards sont **réutilisées hors famille** (d'où des imports `../semantic/`
depuis les autres dossiers) : `SemanticPairsCard` par `../structure/AnomaliesCard`,
`NodeInspector` par `../lexical/LexicalCard`, `SemantiqueCard` par
`../lexical/VocabulaireCard`.
