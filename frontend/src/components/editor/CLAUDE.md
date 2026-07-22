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
  hauteur définie indépendante du contenu.
- **Liens internes** : un `<a class="lien-interne" href="internal:{id}">` (posé à
  l'import ODT ou par la toolbar Quill) navigue vers le nœud cible plutôt que
  d'activer l'édition (`onFrameClick` intercepte avant `onColumnClick`). La
  CRÉATION d'un lien (`ArticlePickerModal.vue`) reste à rebrancher.
