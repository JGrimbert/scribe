# Composables

Logique Vue à état (refs, computed, composition d'autres composables) qui ne
mérite pas d'être un composant. Logique pure sans état → `../script/` ; UI →
`../components/`.

## Édition (moteur de `FolioView`)

`../components/FolioView.vue` (rendu Paged.js en iframe, l'UNIQUE éditeur — cf.
`../components/CLAUDE.md`) instancie ces composables et fait le câblage. Ils
reprennent la mécanique de l'ancien éditeur, avec le DOM Folio désormais dans
l'iframe (coordonnées recalées par l'offset de la frame). FolioView ne garde que
les **helpers DOM de l'iframe** (`frameDoc`/`findFragEl`/`listFragEls`/
`frameOffset`, propres au composant racine — cf. « Découplage ») et le câblage.

- **`useFolioFrame.js`** — construit l'iframe Paged.js et la (re)pagine
  (`buildFrame`/`refresh`/`teardown`) ; en édition, (re)construit `registry`/
  `fragments` depuis le flow (partagés avec `useFragmentEditor`). Reçoit
  `frameRef`/`frameDoc`/`blocks`/`section` + trois callbacks : `onReset` (vider le
  curseur), `onPaginated` (recaler l'échelle), `getEditListeners` (les listeners du
  doc iframe, résolus au (dé)montage — ils vivent chez FolioView). Ces callbacks
  cassent le cycle frame↔échelle : la frame n'importe pas l'échelle, elle la
  notifie.
- **`useFolioScale.js`** — l'échelle du rendu (`fitScale` : largeur → `visiblePages`
  ET hauteur, le plus contraignant l'emporte) + son `ResizeObserver`. Reçoit
  `rootRef`/`frameRef`/`frameDoc`. Le `clientHeight` vient du flex parent
  (indépendant du contenu → pas de boucle de rétroaction d'échelle).
- **`useFakeCaret.js`** — faux curseur clignotant / rectangles de sélection. Le
  DOM paginé (dans l'iframe, régénéré à chaque `refresh()`) n'est pas éditable ;
  ce composable pilote l'overlay visuel superposé, téléporté dans le body
  principal. Reçoit `findFragEl` + `frameOffset` (l'offset écran de l'iframe,
  ajouté aux rects).
- **`useFloatingToolbar.js`** — positionne la toolbar Quill (téléportée dans
  `<body>` par `QuillBlock`) au-dessus de la sélection courante.
- **`useFragmentEditor.js`** — cycle de vie de l'édition MONO-fragment
  (activer/fermer/commit/merge, navigation ↑/↓, clic/drag mono). Reçoit
  `caret`/`toolbar`/`findFragEl`/`refresh`/`scalePercent`/`keyboardTarget` par
  injection (pas d'import direct), voir « Découplage ». Instancie
  `useCrossSelection` et lui passe trois callbacks vers l'état mono
  (`flushEditor` = persister+fermer, `openTexteFragment` = rouvrir, `armSuppressClick`).
- **`useCrossSelection.js`** — la sélection à cheval sur PLUSIEURS fragments
  (`crossSelection` : coupure de page interne OU vraie frontière de paragraphe).
  Aucun Quill ne peut la représenter (un seul monté à la fois) : elle se traite
  directement sur le modèle (`registry.deleteRange`), avec overlay reconstruit
  rect par rect et interception clavier ciblée (voir « Pièges éditeur » de
  `../script/CLAUDE.md`). Découplée de l'édition mono par les callbacks ci-dessus.

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
