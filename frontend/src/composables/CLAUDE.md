# Composables

Logique Vue à état (refs, computed, composition d'autres composables) qui ne
mérite pas d'être un composant. Logique pure sans état → `../script/` ; UI →
`../components/`.

## Édition (moteur de `FolioView`)

`../components/FolioView.vue` (rendu Paged.js en iframe, l'UNIQUE éditeur — cf.
`../components/CLAUDE.md`) instancie ces trois-là et fait le câblage. Ils
reprennent la mécanique de l'ancien éditeur, avec le DOM Folio désormais dans
l'iframe (coordonnées recalées par l'offset de la frame).

- **`useFakeCaret.js`** — faux curseur clignotant / rectangles de sélection. Le
  DOM paginé (dans l'iframe, régénéré à chaque `refresh()`) n'est pas éditable ;
  ce composable pilote l'overlay visuel superposé, téléporté dans le body
  principal. Reçoit `findFragEl` + `frameOffset` (l'offset écran de l'iframe,
  ajouté aux rects).
- **`useFloatingToolbar.js`** — positionne la toolbar Quill (téléportée dans
  `<body>` par `QuillBlock`) au-dessus de la sélection courante.
- **`useFragmentEditor.js`** — le plus gros : cycle de vie complet de l'édition
  par fragment (activer/fermer/commit/merge, navigation ↑/↓) ET la sélection
  cross-fragment (`crossSelection` — à cheval sur plusieurs fragments, traitée
  directement sur le modèle puisqu'aucun Quill ne peut la représenter ; voir
  « Pièges éditeur » de `../script/CLAUDE.md`). Reçoit `caret`/`toolbar`/
  `findFragEl`/`refresh`/`scalePercent`/`keyboardTarget` par injection (pas
  d'import direct), voir « Découplage ».

## Registre, typologie, analyse

Carte des autres composables (détails dans le `CLAUDE.md` du composant
consommateur) :

- **`useRegistry.js`** — état de **MODULE** (pas d'instance) : liste des
  documents + import, montés à deux endroits (accueil, aside config). Deux copies
  divergeraient au premier import. Porte aussi `pendingPreview`,
  `confirmAndDelete`. Voir `../components/CLAUDE.md` (« Registre et aside »).
- **`useTypologyConfig.js`** — données de l'écran de config (inventaire, styles,
  highlights, rules, settled, sections). Voir `../components/config/CLAUDE.md`.
- **`useStructureShapes.js`** — modèles de structure par niveau, traduits en
  rôles contre la typologie en cours d'édition. Voir `../components/config/`.
- **`useAnalyse.js`** — store du dashboard (`provideAnalyse()` dans la vue,
  `useAnalyse()` dans les cards). Voir `../components/analyse/CLAUDE.md`.
- **`useLexicalGraph.js`** / **`useCloudFilters.js`** / **`useWordCloud.js`** —
  état des visualisations lexicales (réseau, nuage). Voir `../components/analyse/`.

## Règles

- **Pas de duplication entre variantes symétriques.** Deux fonctions qui ne
  diffèrent que par un paramètre → une fonction interne + param plutôt que
  copier-coller (cf. `mergeFragment(direction)` où `direction` vaut `'mergeNext'`
  ou `'mergePrev'`, appelé par deux wrappers d'une ligne).
- **Découplage par injection, pas par import croisé.** `useFragmentEditor` reçoit
  `caret`/`toolbar` en paramètre plutôt que de les importer/instancier.
  `FolioView` instancie les trois et câble. Garde chaque composable testable
  indépendamment et évite les dépendances circulaires implicites.
- **Ne pas envelopper le retour dans `reactive()`.** Retourner un objet plat de
  `ref`/fonctions ; le composant appelant déstructure au niveau racine de son
  `<script setup>` (`const { cursorRect } = useFakeCaret(...)`) pour bénéficier de
  l'auto-unwrap dans le template — une déstructuration nichée n'en profite pas.
- **`findFragEl` est injecté, pas recréé.** Il dépend du DOM de l'iframe, propre
  au composant racine — défini une fois dans `FolioView.vue` et passé en
  paramètre (avec `listFragEls`, `frameOffset`, `keyboardTarget`).

## Piège à ne pas réintroduire — remount Vue

`useFragmentEditor.js` ferme puis rouvre l'éditeur (`closeEditor()` +
`activateFragment()`) après un split (Entrée) ou une fusion (Backspace/Delete).
Si le fragment rouvert a le même id que celui qu'on vient de fermer (fréquent :
fusionner avec le suivant garde le même index), le faire dans le même tick
synchrone ne déclenche PAS de remount Vue réel — `<QuillBlock>` (keyé par
`editingId`) garde son contenu périmé. D'où `settleClose()` (`await nextTick()`)
entre les deux. Ne pas supprimer cet await en pensant que c'est un no-op.
