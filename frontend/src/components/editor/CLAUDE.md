# Éditeur — `components/editor/`

`FolioView.vue` est l'**UNIQUE** rendu paginé (Paged.js dans une `<iframe>`),
modes `read` (aperçu compact d'une page) et `edit` (rangée de pages + édition).
`EditorView.vue` (route `noeud/:nodeId?`) le monte en `mode="edit"` ; l'aperçu
`read` sert aussi dans la config (`../config/TypologySection.vue`). La logique pure
(buildBlocks, registry, fragment, liveEdit, syncQuill, quillCaret) et le glossaire
fragment/bloc/paragraphe vivent dans `../../script/CLAUDE.md` ; le cycle d'édition
dans `../../composables/CLAUDE.md`.

À connaître au niveau composant :
- **Le DOM Folio vit dans l'iframe** : le faux curseur / les rects de sélection
  (téléportés dans le body principal) sont recalés par l'offset de la frame
  (`frameOffset`). `getComputedStyle`/`getBoundingClientRect` se lisent dans le
  réalm de l'iframe.
- **Quill est invisible par défaut** (prop `quillVisible`, debug only) : le
  WYSIWYG est le miroir Folio + faux curseur ; Quill ne fait que capter la frappe.
  `syncQuill` aligne ses MÉTRIQUES (wrapping), pas sa position.
- **`fitScale`** ajuste l'échelle sur la largeur (viser `visiblePages`) ET la
  hauteur ; le `clientHeight` vient du flex parent (**indépendant du contenu →
  pas de boucle de rétroaction d'échelle**). `.folio-view--edit` doit garder une
  hauteur définie indépendante du contenu. Il notifie `onScaled` après chaque
  passe : le frame change de largeur, et la `CustomScrollbar` (ci-dessous) doit
  être remesurée — elle ne surveille pas le style inline du frame.
- **Scroll de la rangée de pages (édition)** géré par `CustomScrollbar`
  (`../ui/atoms/`), pas par un `overflow` natif (le DS proscrit les barres
  natives). Le padding `EDIT_PAD` (respiration autour des pages) vit sur le
  wrapper `.folio-pad` (`width:max-content`) pour que `scrollWidth` l'inclue.
  Le mode `read` (aperçu config) ne défile pas → pas de `CustomScrollbar`, pour
  ne pas coller un `ResizeObserver`/`MutationObserver` à chaque aperçu (jusqu'à 3
  sur l'écran config). **Molette → horizontal** : les pages étant dans l'iframe,
  la molette y naît (le conteneur parent ne la voit pas) ; le listener `wheel` du
  doc iframe (via `editListeners`, `passive:false`) la relaie à
  `CustomScrollbar.handleWheel` qui convertit `deltaY` en scroll horizontal.
- **Anti-flicker (double-buffer)** : chaque repagination rend dans un conteneur caché
  (`opacity:0`) pendant que `#render` garde l'ancien rendu affiché (pas de page
  blanche), puis swap. Trois pièges, tous résolus dans `useFolioFrame`/`useFolioScale` :
  1. **Flash 100 %** — Paged.js peint à taille naturelle avant l'échelle : le tampon
     caché absorbe ce paint, on ne révèle que le résultat mis à l'échelle.
  2. **La page « change de taille » (le vrai coupable des pages 2+)** — Paged.js
     ré-injecte son polyfill dans le `<head>` PARTAGÉ de l'iframe à CHAQUE pagination,
     et ce polyfill remet `--pagedjs-width/height/margin-*` à leur défaut **US Letter**
     avant que l'override `@page` (A5) ne repasse. Comme le double-buffer laisse
     l'ancien rendu visible pendant la pagination, ce basculement se voyait à l'écran.
     Corrigé en **épinglant** ces variables (`:root`, `!important`) dans le boot de
     l'iframe — `buildPagePinCss(props.page)`, cf. `../../script/folioStyles.js`.
  3. **Re-layout d'iframe parasite** — `fitScale` réécrivait `frame.style.width` à
     chaque appel avec une valeur que le navigateur relit arrondie (donc « différente »)
     → l'iframe se re-layoutait pour rien. `applyScale` est désormais **idempotent**
     (skip si échelle+dimensions inchangées à la tolérance sub-pixel), ce qui éteint
     aussi la 2ᵉ passe que le `ResizeObserver` de `useFolioScale` déclenchait.

  On injecte un **clone inerte** du rendu (`cloneNode` ne recopie ni les `ResizeObserver`
  que Paged laisse sur chaque page, ni les listeners) et on jette le tampon. Le registre
  (`buildFragmentRegistry`) est construit AVANT le clone (il stampe les `data-frag-id`,
  dont le clone hérite) et ne garde que des chaînes HTML — pas de référence DOM vivante.
  `onReset` ne fait plus que vider le curseur, `onPaginated` recale l'échelle.
  *Teardown Paged* : avant de jeter le tampon, `disconnectPagedObservers` détruit les
  `Page` du previewer (`chunker.pages[].destroy()` → `removeListeners`), sinon le rAF
  planifié par leur `ResizeObserver` tombe sur un nœud détaché et lève un `TypeError`.
- **Liens internes** : un `<a class="lien-interne" href="internal:{id}">` (posé à
  l'import ODT ou par la toolbar Quill) navigue vers le nœud cible plutôt que
  d'activer l'édition (`onFrameClick` intercepte avant `onColumnClick`). La
  CRÉATION d'un lien (`ArticlePickerModal.vue`) reste à rebrancher.
