<template>
  <div ref="rootRef" class="folio-view" :class="`folio-view--${mode}`">
    <div class="folio-scroll">
      <iframe ref="frameRef" class="folio-frame" :title="mode === 'edit' ? 'Pages du chapitre' : 'Aperçu de page'" />
    </div>
    <p v-if="!hasContent" class="folio-empty">Aucun aperçu disponible.</p>

    <!-- Indicateur de zoom (édition), épinglé hors de la zone scrollable. -->
    <div v-if="mode === 'edit' && hasContent" class="scale-indicator">{{ Math.round(scalePercent) }} %</div>

    <!-- ─── Édition : overlays téléportés dans le body principal ─────────────── -->
    <template v-if="mode === 'edit'">
      <!-- Quill flottant (invisible par défaut : l'utilisateur voit le miroir
           Folio + le faux curseur ; Quill ne fait que capter la frappe). Placé
           par syncQuill au-dessus du fragment, avec l'offset iframe. -->
      <Teleport to="body">
        <div
            v-if="editorVisible"
            class="fragment-editor"
            :class="{ 'fragment-editor--hidden': !quillVisible }"
        >
          <QuillBlock
              ref="quillBlockRef"
              :key="editingId"
              :model-value="initialHtml"
              :initial-index="pendingIndex"
              :initial-length="pendingLength"
              :is-first-fragment="isFirstFragment"
              :is-last-fragment="isLastFragment"
              active
              @state-change="onFragmentStateChange"
              @maj="commitEdit"
              @merge-next="mergeNextFragment"
              @merge-prev="mergePrevFragment"
              @arrow-down="navigateDown"
              @arrow-up="navigateUp"
              @toolbar-ready="registerToolbar"
              @quill-ready="syncActiveQuill"
              @request-internal-link="() => {}"
          />
        </div>
      </Teleport>

      <Teleport to="body">
        <div
            v-if="cursorRect"
            class="fake-cursor"
            :style="{ top: cursorRect.top + 'px', left: cursorRect.left + 'px', height: cursorRect.height + 'px' }"
        />
        <div
            v-for="(rect, i) in selectionRects"
            :key="i"
            class="fake-selection-rect"
            :style="{ position: 'fixed', top: rect.top + 'px', left: rect.left + 'px', width: rect.width + 'px', height: rect.height + 'px' }"
        />
      </Teleport>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuillBlock from './QuillBlock.vue'
import { buildBlocks } from '../../script/paginate.js'
import { syncQuillToFragment } from '../../script/syncQuill.js'
import { useFakeCaret } from '../../composables/useFakeCaret.js'
import { useFloatingToolbar } from '../../composables/useFloatingToolbar.js'
import { useFragmentEditor } from '../../composables/useFragmentEditor.js'
import { useFolioFrame } from '../../composables/useFolioFrame.js'
import { useFolioScale } from '../../composables/useFolioScale.js'

const props = defineProps({
  // 'read' : aperçu compact (une page, sans édition).
  // 'edit' : la rangée de pages du chapitre + édition (Quill flottant, curseur,
  //          sélection) — même mécanique que l'éditeur historique, mais le DOM
  //          Folio vit dans l'iframe (coordonnées recalées par l'offset).
  mode: { type: String, default: 'read' },
  data: { type: Object, default: null },
  nodeId: { type: String, default: null },
  depth: { type: Number, default: 0 },
  visiblePages: { type: Number, default: 2.2 },
  // Apparence des styles ODT (map nom→StyleVisual, cf. GET /documents/:id) :
  // la feuille injectée dans l'iframe rend chaque bloc fidèle au .odt. Null =
  // look générique de paged.css (document sans styles.xml lu).
  visuals: { type: Object, default: null },
  // Format de page du .odt (dimensions + marges, cf. PageFormat). Piloté en
  // @page dans l'iframe. Null = A5 par défaut (paged.css).
  page: { type: Object, default: null },
  // Debug : rendre visible le Quill flottant (sinon seul le miroir Folio l'est).
  quillVisible: { type: Boolean, default: false },
})

const rootRef = ref(null)
const frameRef = ref(null)

// Helpers DOM de l'iframe, propres au composant racine (cf. composables/CLAUDE.md :
// findFragEl est injecté, pas recréé). Injectés dans les composables Folio/fragment.
function frameDoc() {
  return frameRef.value?.contentDocument ?? null
}
function findFragEl(fragId) {
  return frameDoc()?.querySelector(`[data-frag-id="${fragId}"]`) ?? null
}
function listFragEls() {
  return Array.from(frameDoc()?.querySelectorAll('[data-frag-id]') ?? [])
}
// Offset écran de l'iframe, ajouté aux rects du faux curseur/sélection (dont les
// coordonnées sortent du viewport de l'iframe).
function frameOffset() {
  const r = frameRef.value?.getBoundingClientRect()
  return r ? { x: r.left, y: r.top } : { x: 0, y: 0 }
}

// Le nœud à rendre, et ses blocs (mêmes que l'éditeur via buildBlocks). `section`
// est l'OWNER du registre : muté en place par l'édition (son `texte` est le même
// tableau que data[nodeId], donc les modifs persistent).
const item = computed(() => (props.nodeId ? props.data?.[props.nodeId] : null))
const hasContent = computed(() => !!item.value)
const section = computed(() => (item.value ? { ...item.value, id: props.nodeId, depth: props.depth } : null))
const blocks = computed(() => (section.value ? buildBlocks([section.value]) : []))

const { scaleRef, scalePercent, fitScale } = useFolioScale(props, { rootRef, frameRef, frameDoc })

const caret = useFakeCaret(findFragEl, frameOffset)
const toolbar = useFloatingToolbar()
const { cursorRect, selectionRects } = caret
const { registerToolbar } = toolbar

const { registry, fragments, buildFrame, refresh, teardown } = useFolioFrame(props, {
  frameRef,
  frameDoc,
  blocks,
  section,
  // Vider le curseur avant chaque repagination, recaler l'échelle après.
  onReset: () => caret.clear(),
  onPaginated: () => fitScale(),
  // Les listeners du doc iframe (édition), résolus au (dé)montage — cf. editListeners.
  getEditListeners: () => editListeners,
})

const {
  quillBlockRef,
  editorVisible,
  editingId,
  initialHtml,
  pendingIndex,
  pendingLength,
  isFirstFragment,
  isLastFragment,
  onColumnClick,
  onColumnMouseDown,
  onColumnMouseUp,
  onFragmentStateChange,
  commitEdit,
  mergeNextFragment,
  mergePrevFragment,
  navigateDown,
  navigateUp,
} = useFragmentEditor({
  findFragEl,
  listFragEls,
  registry,
  fragments,
  refresh,
  scalePercent,
  caret,
  toolbar,
  // Le clavier de la sélection cross-fragment écoute le document de l'iframe (le
  // focus y vit après un drag). Fonction : résolue quand on branche le listener.
  keyboardTarget: () => frameDoc() ?? document,
})

const route = useRoute()
const router = useRouter()

// Un lien interne (posé à l'import ODT, ou depuis la toolbar Quill) navigue vers
// le nœud cible plutôt que d'activer l'édition du fragment cliqué — sinon
// onColumnClick prend la main. Seule la NAVIGATION est portée ici ; la création
// d'un lien (ArticlePickerModal) reste à rebrancher (cf. FolioComposer historique).
function onFrameClick(e) {
  const link = e.target.closest?.('a.lien-interne')
  if (link) {
    e.preventDefault()
    e.stopPropagation()
    const href = link.getAttribute('href') || ''
    if (href.startsWith('internal:')) {
      router.push(`/documents/${route.params.id}/noeud/${href.slice('internal:'.length)}`)
    }
    return
  }
  onColumnClick(e)
}

// Métriques ISO du fragment ACTIF : sans ça, la boîte Quill wrappe le texte
// autrement que la page → décalages en navigation ↑/↓. useFragmentEditor ne
// synchronise que le fragment QUITTÉ ; on complète ici pour l'actif. Déclenché
// par l'event `quill-ready` de QuillBlock (fin de mountQuill, `.ql-editor`
// garanti présent) et NON par un watch(editingId)+nextTick, qui tombait avant
// le montage async de Quill (course : la synchro ne s'exécutait pas).
function syncActiveQuill() {
  const el = findFragEl(editingId.value)
  const wrapper = quillBlockRef.value?.$el
  if (!el || !wrapper) return
  syncQuillToFragment({
    fragmentEl: el,
    quillWrapperEl: wrapper,
    quillInnerEl: wrapper.querySelector('.ql-editor'),
    scale: scaleRef.value,
  })
}

// Listeners attachés au doc de l'iframe en édition. Le getter passé à useFolioFrame
// les résout au (dé)montage : onColumnMouseDown/Up viennent de useFragmentEditor,
// onFrameClick d'ici — ils n'existent donc qu'à ce niveau.
const editListeners = props.mode === 'edit'
  ? { click: onFrameClick, mousedown: onColumnMouseDown, mouseup: onColumnMouseUp }
  : null

onMounted(buildFrame)
onBeforeUnmount(teardown)

// Changement de nœud/niveau : repagine. L'édition, elle, repagine via refresh()
// (appelé par useFragmentEditor) — pas besoin d'observer le contenu ici, ce qui
// éviterait de repaginer deux fois après une frappe.
watch(() => [props.nodeId, props.depth], refresh)
</script>

<style scoped>
.folio-view {
  position: relative;
  width: 100%;
  min-height: 4em;
}

/* Édition : remplit la hauteur disponible (flex du .scroll-folio parent) — d'où
   un clientHeight stable, indépendant du contenu, pour fitScale. Le défilement
   horizontal des pages vit dans .folio-scroll, pas ici (l'indicateur de zoom
   reste ainsi épinglé). */
.folio-view--edit {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.folio-scroll {
  width: 100%;
  height: 100%;
}

.folio-view--edit .folio-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  /* Respiration généreuse autour des pages (cf. EDIT_PAD, que fitScale retire de
     la place disponible). box-sizing pour que le 100% inclue ce padding. */
  padding: 40px;
  box-sizing: border-box;
}

.folio-frame {
  display: block;
  width: 100%;
  border: 0;
}

.folio-view--read .folio-frame {
  margin-inline: auto;
}

/* Zoom : discret, coin bas-droit, au-dessus des pages. */
.scale-indicator {
  position: absolute;
  right: var(--sp-2);
  bottom: var(--sp-2);
  padding: 0.1em 0.5em;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-surface) 80%, transparent);
  border: 1px solid var(--c-border);
  color: var(--c-ink2);
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.folio-empty {
  margin: 0;
  padding: var(--sp-4);
  color: var(--c-ink2);
  font-size: var(--fs-sm);
  text-align: center;
}

/* Quill flottant + faux curseur/sélection : téléportés dans le body (le scoped
   s'y applique, Vue marque le vnode). Repris de FolioComposer — capture invisible
   par défaut (quillVisible=false) ; le WYSIWYG est le miroir Folio + faux curseur.
   Le `top/right/width` doit rester : sans lui la fenêtre debug n'a ni place ni
   taille et paraît absente. */
.fragment-editor {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 360px;
  max-height: 80vh;
  overflow: auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.fragment-editor--hidden {
  opacity: 0;
  pointer-events: none;
}

.fake-cursor {
  position: fixed;
  width: 2px;
  background: #2f6fed;
  pointer-events: none;
  z-index: 999;
  animation: fake-blink 1s steps(1) infinite;
}

@keyframes fake-blink {
  50% { opacity: 0; }
}

.fake-selection-rect {
  position: fixed;
  background-color: rgba(0, 100, 255, 0.25);
  pointer-events: none;
  z-index: 5;
  border-radius: 1px;
}
</style>
