# Cards structure — `components/analyse/structure/`

Famille **sans NLP** : dérivée du seul contenu du document, calculée côté backend
au GET (jamais « indisponible » ni en attente du NLP). `CompletenessChart`,
`ConformityChart`, `AnomaliesCard`/`AnomaliesTable`, `NodesTable`. Cadre commun
`AnalyseBlock` + store `useAnalyse` : cf. `../CLAUDE.md`. Graphes echarts via
`../../ui/organisms/BaseChart` (sémantique couleur dans `../CLAUDE.md`).

- **`AnomaliesCard`/`AnomaliesTable`** — cas MIXTE : le graphe de complétude est
  gratuit (backend, sans NLP) et s'affiche tout de suite, pendant que la table des
  doublons attend le NLP dans la même colonne. `AnomaliesCard` orchestre le bloc
  (importe `CompletenessChart`, `ConformityChart` locaux + `../semantic/SemanticPairsCard`).
  Se sert de `typologySettled` (fourni par `../../layout/DocumentLayout`) pour
  renvoyer vers la config.
- **Rampe ordinale** pour la complétude (vide → ébauche → partiel → rédigé) :
  `--c-ramp-*`, jamais du catégoriel — l'ordre porte le sens (cf. « couleurs » dans
  `../CLAUDE.md`).
