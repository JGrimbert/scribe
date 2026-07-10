# Scribe — frontend

Éditeur de texte Vue destiné à l'édition print (rendu paginé, WYSIWYG). Stack :
Vue 3 (`<script setup>`) + Vite, Quill 2 (édition), Paged.js / `pagedjs` (pagination
à la manière d'un livre imprimé), PrimeIcons.

Fait partie du monorepo `scribe` (voir `../CLAUDE.md` pour les règles générales
et l'organisation frontend/backend). Le backend NestJS (`../backend`) expose
désormais un registre de documents (Postgres/Prisma) — voir `../CLAUDE.md`
pour les deux chemins de données qui coexistent (registre backend vs fichiers
statiques `Marvarid/` historiques).

## Vues — `App.vue`

`App.vue` bascule entre deux vues via `currentView` (`'registry' | 'editor'`) :
- **`registry`** (défaut) — `RegistryView.vue` : tableau des documents
  importés (`GET /api/documents`), upload d'un `.odt`
  (`POST /api/documents/upload`), sélection d'une ligne → émet `select`.
- **`editor`** — `StructureView` (actuellement invisible, `visibility:hidden`
  en CSS, ne reçoit plus de `structure` peuplée) + `FolioComposer`/`Scroll`
  (Scroll toujours désactivé, `v-if="false === true"`).

`onSelectDocument(id)` (`App.vue`) appelle `GET /api/documents/:id`, peuple
`trame`/`data`, puis bascule sur `editor`. `/api` est proxifié vers le backend
Nest par `vite.config.js` (`server.proxy`) — dev uniquement, rien de prévu
encore pour la prod (le frontend buildé n'a pas de backend à contacter en
statique).

## Vocabulaire — Quill vs Folio

Deux couches, deux mots, à ne jamais mélanger :

- **Quill** : l'éditeur WYSIWYG flottant (`QuillBlock.vue`). Invisible en
  propre — il n'édite qu'UN fragment à la fois et se superpose visuellement
  au rendu paginé pendant l'édition (voir `syncQuill.js`). Ce n'est jamais
  ce que l'utilisateur regarde en lecture.
- **Folio** : la couche de rendu paginé (implémentée avec Paged.js), celle
  qu'on regarde. "Paged"/"Paged.js" désigne la librairie sous-jacente ;
  **"Folio" est le mot à utiliser en code et en discussion** pour tout ce qui
  concerne cette couche. Composants : `FolioComposer.vue` (orchestrateur),
  `Folia.vue` (l'ensemble scalé, plusieurs pages), `Folio.vue` (une page
  physique unique, recto/verso).

Un changement touche Quill (comportement d'édition, clavier, contenu du
fragment) XOR Folio (mise en page, pagination, rendu visuel des pages) —
identifier laquelle des deux est en cause avant de chercher le bug évite de
fouiller le mauvais fichier.

## Glossaire — à lire avant de toucher à l'édition

Trois notions distinctes, systématiquement confondues si on ne les note pas :

- **Paragraphe** : une entrée de `article.texte[]`. L'unité sémantique réelle,
  celle que l'utilisateur pense éditer.
- **Bloc** (`blockId`) : la représentation d'UN paragraphe avant pagination.
  Id déterministe et positionnel : `${articleId}__texte__${index}` (construit
  dans `buildBlock()`, `src/script/paginate.js`). Recalculé à chaque
  `refresh()` à partir de l'état courant de `article.texte`.
- **Fragment (de pagination)** (`fragId` = `${blockId}::${ordinal}`) : un
  MORCEAU de bloc, quand Paged.js coupe un paragraphe entre deux pages.
  L'édition se fait fragment par fragment : Quill ne charge que le texte
  d'UN fragment à la fois (`fragments.getFragment(fragId)`). `setFragment()`
  recolle les fragments d'un même bloc (frontière de pagination, invisible
  pour l'utilisateur) avant de traiter les vraies frontières de paragraphe
  (celles que Quill introduit via plusieurs `<p>`).

Conséquence directe : atteindre la fin du texte chargé dans Quill ne veut PAS
dire qu'on est à la fin du paragraphe — seulement à la fin de CE fragment. Voir
`isFirstFragment`/`isLastFragment` (`src/script/fragment.js:getFragmentPosition`)
qui distinguent "bord du paragraphe" de "coupure de page interne".

## Architecture

Flux : `FolioComposer.vue` pagine (`paginate.js` → Paged.js) → construit un
`registry` (modèle de données par bloc) et une `fragments` API (registre de
fragments) → délègue l'édition interactive à `useFragmentEditor`.

Fichiers clés :
- `src/components/FolioComposer.vue` — orchestrateur : cycle de pagination
  (`refresh`/`scheduleReflow`), instancie les composables, câble le template.
- `src/components/QuillBlock.vue` — Quill flottant, un fragment à la fois ;
  gère Entrée (split), Backspace/Delete (merge), gated par
  `isFirstFragment`/`isLastFragment`.
- `src/composables/useFragmentEditor.js` — cycle de vie de l'édition par
  fragment (activer/fermer/commit/merge) et sélection cross-fragment
  (`crossSelection`, voir "Pièges connus"). Voir `src/composables/CLAUDE.md`.
- `src/composables/useFakeCaret.js`, `useFloatingToolbar.js` — le DOM paginé
  (`v-html`) n'est pas éditable ; un faux curseur/sélection et une toolbar
  flottante sont positionnés par-dessus et mirroirés depuis Quill.
- `src/script/paginate.js` — appelle Paged.js, construit les blocs à partir de
  `article.texte`.
- `src/script/registry.js` — logique pure sur le modèle de données :
  `applyEdit` (HTML → paragraphes), `mergeNext`/`mergePrev` (retournent
  `{ index, cursor }`, le point de jonction pour repositionner le curseur),
  `deleteRange` (supprime/remplace une sélection à cheval sur un ou
  plusieurs paragraphes, `keepSplit` distingue Entrée du reste).
- `src/script/fragment.js` — registre de fragments : `getFragment`/
  `getBlockId`/`setFragment` (glue), `locateIndex` (index global → bon
  fragment), `getFragmentPosition` (ordinal/total, vrai bord vs coupure interne),
  `globalIndex` (inverse de `locateIndex` : fragId + index local → index
  global dans le paragraphe complet).
- `src/script/liveEdit.js` — maths caret/sélection sur DOM (index de
  caractère ↔ rect pixel), via `TreeWalker` sur les nœuds texte.
  `getRangeRects` calcule les rects d'une plage de texte scopée à UN seul
  élément (utilisé fragment par fragment pour l'overlay d'une sélection
  cross-fragment, plutôt qu'une Range native enjambant plusieurs éléments).
- `src/script/syncQuill.js` — positionne/scale le Quill flottant pour qu'il
  coïncide visuellement avec le fragment DOM sous-jacent.

## Pièges connus

- **Piège du remount Vue** : fermer l'éditeur (`closeEditor()`) puis le
  rouvrir (`activateFragment()`) dans le MÊME tick synchrone ne démonte
  jamais réellement `<QuillBlock>` si le nouveau `fragId`/`:key` finit par
  être identique à l'ancien (ex: fusionner avec le paragraphe suivant garde
  le même index) — Vue ne voit qu'un état inchangé au flush. Résultat : le
  Quill flottant garde son contenu périmé. **Toujours `await nextTick()`**
  entre une fermeture et une réactivation qui peut retomber sur le même id
  (voir `settleClose()` dans `useFragmentEditor.js`).
- Le curseur de fusion (`registry.js`, `merged.length`) est une longueur de
  chaîne HTML brute, pas un compte de caractères visibles — fiable pour du
  texte simple, pas garanti si un paragraphe contient du formatage inline
  (`<strong>`, `<em>`...). Pas encore de bug connu là-dessus, mais à garder
  en tête si un paragraphe fusionné se retrouve mal positionné.
- Backspace/Delete avec un curseur **collapsé** en bord de fragment ne
  fusionne toujours qu'aux vrais bords de paragraphe (`isFirstFragment`/
  `isLastFragment` dans `QuillBlock.vue`) : à une coupure de page interne,
  c'est un no-op sûr. Cette limitation-là reste — un seul Quill est monté à
  la fois, il ne "voit" que son propre fragment.
- En revanche, une **sélection** (drag) qui enjambe plusieurs fragments —
  coupure de page interne à un paragraphe OU vraie frontière entre deux
  paragraphes — est gérée depuis peu par `useFragmentEditor.js`
  (`crossSelection` / `activateCrossSelection` / `handleCrossSelectionKeydown`) :
  aucun Quill ne représente cette sélection, la suppression/fusion/split
  (Entrée) se fait directement sur `article.texte` via `registry.deleteRange`,
  puis l'éditeur se rouvre normalement au point de jonction. L'overlay
  (`getRangeRects`, `liveEdit.js`) et l'interaction clavier n'ont pu être
  vérifiés qu'au niveau logique/tests — pas de vérification navigateur
  possible ici, à confirmer manuellement avant de considérer le sujet clos.

## Tests

- Vitest + jsdom. `npm test` (run), `npm run test:watch`. Config :
  `vitest.config.js`. Tests colocalisés `*.test.js` à côté du fichier testé.
- Portée actuelle : logique pure dans `src/script/` (`registry.js`,
  `fragment.js`) — pas de dépendance DOM/Quill/Paged.js réelle. C'est
  volontaire : ça permet de verrouiller les règles de fusion/split sans
  mocker Quill ou Paged.js.
- Pas encore de tests d'intégration DOM/Quill (Vue Test Utils) ni e2e
  (Playwright) — **prévu à terme, pas encore en place**. Tant que ça
  n'existe pas, toute interaction clavier/souris dans `QuillBlock.vue`/
  `FolioComposer.vue` doit être vérifiée manuellement en navigateur avant
  d'être considérée comme corrigée (cf. section précédente).

## Commandes

Depuis `frontend/` :
```
npm run dev         # serveur de dev Vite
npm test             # vitest run
npm run test:watch   # vitest en mode watch
npm run build         # build de prod (supprimer dist/ après une build de vérif)
```
Depuis la racine du monorepo, équivalent via `--workspace frontend` (voir
`../CLAUDE.md`), ou `npm run dev` à la racine pour lancer frontend + backend
ensemble.

## Conventions de code

- Logique pure et sans état Vue → `src/script/*.js`. Logique avec état/cycle
  de vie Vue (`ref`, `computed`, composition d'autres composables) →
  `src/composables/use*.js`. Composants → `src/components/*.vue`.
- Éviter la duplication en isolant le protocole commun dans une fonction
  partagée plutôt qu'en dupliquant deux variantes quasi identiques (ex :
  `mergeFragment(direction)` partagé par merge-next/merge-prev plutôt que
  deux fonctions copiées-collées).
- Commentaires en français, uniquement quand le "pourquoi" n'est pas évident
  (contrainte cachée, contournement, comportement surprenant). Ne pas
  commenter ce que le code dit déjà.
- Ne pas créer de fichiers `*.md` de documentation/plan sauf demande explicite.
