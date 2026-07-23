# Atomes — `components/ui/atoms/`

Primitives indivisibles : ne composent aucun autre composant. `BaseButton`,
`BaseChip`, `BaseSelect`, `UiHint`, `UiCallout`, `ScoreBar`, `StackedBar`,
`CustomScrollbar`. Tokens : `../../../assets/base.css` (cf. `../CLAUDE.md`). Chaque
composant a sa story colocalisée.

- **`ScoreBar` vs `StackedBar`** : `ScoreBar` montre UNE valeur sur une échelle
  (une progression) ; `StackedBar` montre la **répartition** d'un total entre
  catégories — il ne sait pas ce qu'il peint, les couleurs viennent de l'appelant,
  parce que le choix rampe ordinale vs palette catégorielle se décide dans le
  domaine métier (voir « couleurs » dans `../../analyse/CLAUDE.md`).
- **`CustomScrollbar`** : la barre de défilement maison (le DS proscrit les barres
  natives et les scrollbars imbriquées). `height: 100%` par défaut, attend un
  parent à hauteur définie ; portée par `../molecules/UiTable.vue` et par les zones
  de défilement des vues (config, import). Aussi consommée hors DS par
  `../../editor/FolioView.vue` (scroll de la rangée de pages en édition) — seul
  point où la couche Folio réutilise une primitive `ui/`. Elle expose `measure()` :
  un consommateur qui redimensionne son contenu sans muter le DOM (FolioView via
  `fitScale`) doit l'appeler, la barre ne surveillant pas les styles inline.
  Prop `wheelToHorizontal` (opt-in) : la molette verticale défile l'axe x quand
  seul x déborde (rangée horizontale) — utilisée par FolioView.
