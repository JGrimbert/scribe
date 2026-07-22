# Scribe — frontend/src/script

Logique **pure, sans état Vue** : maths de pagination/caret, modèle de données
par bloc, helpers d'analyse et vocabulaires partagés. Tout ce qui a un cycle de
vie Vue (`ref`, `computed`) vit dans `../composables/`, les composants dans
`../components/`.

## Moteur d'édition

Le rendu paginé et l'édition interactive vivent dans `../components/FolioView.vue`
(Paged.js dans une `<iframe>`, cf. `../components/CLAUDE.md`). Ce dossier porte
la logique pure que FolioView orchestre :

- **`paginate.js`** — `buildBlocks(sections)` transforme `article.texte[]` en
  blocs HTML (`data-block-id`) ; choisit le tag de titre (`h1`..`h6`) selon la
  profondeur RÉELLE du nœud (arbre récursif, pas 0/1/2 figé). `paginate()`/
  `measure()` sont l'ancien chemin hors-iframe ; FolioView instancie son propre
  `Paged.Previewer` mais consomme le même `buildBlocks`.
- **`registry.js`** — modèle de données par bloc, logique pure testée
  (`registry.test.js`) : `applyEdit` (HTML → paragraphes), `mergeNext`/
  `mergePrev` (retournent `{ index, cursor }`, le point de jonction pour
  reposer le curseur), `deleteRange` (supprime/remplace une sélection à cheval
  sur un ou plusieurs paragraphes ; `keepSplit` distingue Entrée du reste).
- **`fragment.js`** — registre de fragments, testé (`fragment.test.js`) :
  `getFragment`/`getBlockId`/`setFragment` (glue), `locateIndex` (index global
  → bon fragment), `getFragmentPosition` (ordinal/total, vrai bord de paragraphe
  vs coupure de page interne), `globalIndex` (inverse : fragId + index local →
  index global dans le paragraphe complet). `renderTexteEntry` sérialise une
  entrée de texte.
- **`liveEdit.js`** — maths caret/sélection sur DOM (index de caractère ↔ rect
  pixel) via `TreeWalker`. `getRangeRects` calcule les rects d'une plage scopée
  à UN seul élément — utilisé fragment par fragment pour l'overlay d'une
  sélection cross-fragment, plutôt qu'une `Range` native enjambant plusieurs
  éléments (elle ne survivrait pas au rendu iframe).
- **`syncQuill.js`** — aligne les **MÉTRIQUES** de rendu du Quill flottant sur
  celles du fragment Folio pour que le wrapping y soit identique (d'où
  `isOnFirstLine`/`isOnLastLine` fiables). **Ne repositionne PAS** Quill : il est
  invisible en usage réel (le faux curseur et les rects viennent du DOM Folio,
  pas de la position écran de Quill), sa place à l'écran est indifférente. Lit
  `getComputedStyle` dans le réalm de l'iframe ; gère l'homothétie (le fragment
  vit sous `transform: scale`, son `getBoundingClientRect` est déjà scalé, sa
  `font-size` non).
- **`quillCaret.js`** — `isOnFirstLine`/`isOnLastLine` : un seul Quill est monté
  à la fois, donc la navigation ↑/↓ doit détecter ici qu'on est sur la
  dernière/première ligne **visuelle** (pas juste le dernier caractère) avant de
  laisser la flèche sortir vers le fragment voisin. La résolution du point
  d'arrivée se fait ensuite dans `useFragmentEditor` sur le DOM Folio rendu.
- **`internalLinkBlot.js`** — format Quill custom pour un lien interne
  (`<a href="internal:{id}" class="lien-interne">`), distinct du blot `link`
  natif qui sanitize les schémas non-http. Même marque HTML que celle posée à
  l'import ODT (`odt-parser`, cf. `../../../backend/CLAUDE.md`) → rendu/style/
  clic-navigation partagés. La NAVIGATION est câblée dans FolioView ; la CRÉATION
  d'un lien (`ArticlePickerModal`) reste à rebrancher.

### Glossaire — à lire avant de toucher à l'édition

Trois notions distinctes, systématiquement confondues si on ne les note pas
(version courte dans `../../CLAUDE.md`) :

- **Paragraphe** : une entrée de `article.texte[]`. L'unité sémantique réelle,
  celle que l'utilisateur pense éditer.
- **Bloc** (`blockId`) : la représentation d'UN paragraphe avant pagination. Id
  déterministe et positionnel `${articleId}__texte__${index}` (`buildBlock()`,
  `paginate.js`), recalculé à chaque `refresh()` depuis l'état courant de
  `article.texte`.
- **Fragment (de pagination)** (`fragId = ${blockId}::${ordinal}`) : un MORCEAU
  de bloc, quand Paged.js coupe un paragraphe entre deux pages. L'édition se
  fait fragment par fragment : Quill ne charge que le texte d'UN fragment
  (`fragments.getFragment(fragId)`). `setFragment()` recolle les fragments d'un
  même bloc (frontière de pagination, invisible) avant de traiter les vraies
  frontières de paragraphe.

Conséquence : atteindre la fin du texte chargé dans Quill ne veut PAS dire qu'on
est à la fin du paragraphe — seulement de CE fragment. Voir `isFirstFragment`/
`isLastFragment` (`getFragmentPosition`) qui distinguent bord de paragraphe et
coupure de page interne.

### Pièges éditeur (logique pure)

- Le curseur de fusion (`registry.js`, `merged.length`) est une longueur de
  chaîne HTML brute, pas un compte de caractères visibles — fiable pour du texte
  simple, pas garanti si un paragraphe porte du formatage inline
  (`<strong>`, `<em>`). Pas de bug connu, à garder en tête.
- La **sélection** (drag) enjambant plusieurs fragments (coupure de page interne
  OU vraie frontière de paragraphe) est traitée directement sur `article.texte`
  via `registry.deleteRange` (aucun Quill ne la représente), avec un overlay
  reconstruit rect par rect (`getRangeRects`). Overlay + clavier **vérifiés au
  niveau logique/tests seulement** — vérification navigateur nécessaire.

## Vocabulaires & modèle partagés

- **`typology.js`** — vocabulaires FERMÉS alignés sur le backend (qui refuse tout
  rôle hors liste) : `STYLE_ROLES`, `REQUIRABLE_ROLES`, `HIGHLIGHT_ROLES`,
  libellés de niveau (`DEPTH_TABS`/`DEPTH_LABELS`). Une étiquette libre = une
  faute de frappe qui casse une règle en silence.
- **`zones.js`** — ordre du livre (Liminaire → Chapitrage niveau 1/2/3+ → Partie
  finale) et regroupement par zone : `groupByZone`, `zoneSegments`, `totalOf`,
  `zoneOfDepth`. Source de l'ordre du tableau des styles. Testé (`zones.test.js`).
- **`shapes.js`** — traduction styles→rôles des modèles de structure, en réactif
  contre la typologie en cours d'édition (le backend rend des styles, cf.
  `../../../backend/CLAUDE.md`). Le rôle `corps` ne porte jamais son `×N` (bruit
  attendu). Testé (`shapes.test.js`).
- **`trame.js`** — parcours de l'arbre `trame.axes[]` (profondeur arbitraire) :
  `pathToInAxes` (fil d'Ariane), partagé par `DocumentBar` et `StructureView`.
- **`liminaire-vocab.js`** / **`liminaire-pages.js`** /
  **`liminaire-imposition.js`** / **`liminaire-eligibilite.js`** /
  **`liminaire-config.js`** / **`liminaire-bornes.js`** /
  **`liminaire-suggest.js`** — feature liminaire éclatée par thème (vocabulaire,
  groupement des pages, imposition/planches, éligibilité, accès config, bornes
  absorbables, suggestions). Voir `../components/liminaire/CLAUDE.md`. Chacun
  testé (`*.test.js` colocalisé).
- **`format.js`** — formatage d'affichage (tailles, dates, nombres).

## Helpers d'analyse (dashboard)

Consommés par `../components/analyse/` (voir son `CLAUDE.md`) :
- **`theme.js`** — `cssVar()` : résout un token CSS en valeur calculée pour
  echarts (qui peint dans un `<canvas>` où `var(--…)` n'est jamais résolu). Seul
  usage légitime de `getComputedStyle` pour de la couleur.
- **`cloudLayout.js`** / **`cloudCategories.js`** — layout d3-cloud du nuage de
  lemmes + catégorisation. Testés.
- **`graphMetrics.js`** / **`lexicalSelection.js`** — métriques du réseau lexical
  + sélection. Testés.
- **`semanticPairs.js`** — paires d'articles dédupliquées depuis les voisinages
  top-K (`DUPLICATE_THRESHOLD` sépare les quasi-doublons). Partagé par les cards
  « Textes identiques » et « Paires les plus proches ».
- **`layoutCache.js`** — cache `localStorage` des layouts coûteux (nuage, réseau)
  par `(kind, docId)`, invalidé par une `signature()` (djb2) du contenu d'entrée.
  Une seule entrée par clé, bornée.

## Hors app

- **`sand.js`** — script Node **autonome** (`npm run sand [out.png]`) : génère une
  texture de fond (canvas + simplex-noise). N'est pas importé par l'app ; outil
  d'asset/design isolé.

## Tests

Vitest, colocalisés `*.test.js`. Portée : logique pure (registry, fragment,
zones, shapes, cloudCategories, graphMetrics, lexicalSelection, liminaire*) —
aucune dépendance DOM/Quill/Paged.js réelle. Volontaire : verrouiller les règles
de fusion/split et de ventilation sans mocker Quill ni Paged.js.
