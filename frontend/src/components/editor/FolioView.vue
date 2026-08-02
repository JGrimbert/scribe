<template>
  <div ref="rootRef" class="folio-view" :class="`folio-view--${mode}`">
    <!-- Édition : la rangée de pages défile horizontalement via la CustomScrollbar
         (le DS proscrit les barres natives). Le padding vit sur .folio-pad (wrapper
         shrink-wrap) pour que scrollWidth inclue la respiration des deux côtés. -->
    <!-- Édition ET double-page : même rangée horizontale de pages, ferrée à gauche
         (la 1re page ne bouge pas) et défilée horizontalement via la CustomScrollbar.
         En double-page (`spread`) la barre est masquée (`peek`) — défilement molette
         seul, pour rester harmonieux avec les autres aperçus. -->
    <CustomScrollbar
        v-if="mode === 'edit' || mode === 'spread'"
        ref="scrollbarRef"
        class="folio-scroll"
        wheel-to-horizontal
        :peek="mode === 'spread'"
    >
      <div class="folio-pad">
        <!-- Double-page : filet de reliure/planche. Fond DERRIÈRE l'iframe
             (transparente) → visible dans les gouttières entre pages ; sa zone est
             bornée à l'étendue des pages (updateSpreadBg) pour ne pas déborder dans
             le padding. Période/offset scalés posés en JS. Purement décoratif. -->
        <div v-if="mode === 'spread'" ref="padBgRef" class="folio-pad-bg" aria-hidden="true" />
        <iframe ref="frameRef" class="folio-frame" :title="mode === 'edit' ? 'Pages du chapitre' : 'Double-page'" />
      </div>
    </CustomScrollbar>
    <!-- Aperçu : une seule page mise à l'échelle sur la largeur, aucun défilement. -->
    <div v-else class="folio-scroll">
      <iframe ref="frameRef" class="folio-frame" title="Aperçu de page" />
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
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'
import { buildBlocks, buildImpositionBlocks } from '../../script/paginate.js'
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
  // Marges MIROIR (`{ topCm, bottomCm, innerCm, outerCm }`) : recto/verso inversés
  // en @page:left/@page:right. Null = marges symétriques du .odt (`page`).
  margins: { type: Object, default: null },
  // Réglages de césure (cascade Folio) : `{ global }` = défaut appliqué aux
  // styles que le .odt ne déclare pas explicitement. Null = pas de césure globale
  // (seuls les styles à fo:hyphenate="true" en portent).
  hyphenation: { type: Object, default: null },
  // Titres courants + folio (`{ enabled, verso, recto, folio }`, cf.
  // style-defaults) : la couche Folio les rend en margin boxes @page. Null =
  // désactivés. `bookTitle` alimente l'en-tête ; le nom du chapitre vient du nœud.
  runningTitles: { type: Object, default: null },
  bookTitle: { type: String, default: '' },
  // Planche d'IMPOSITION (aperçu maquette, mode `spread`) : liste ordonnée de
  // pages `{ kind: 'content'|'blank'|'cover'|'empty', entries?, label? }` rendues
  // côte à côte dans un seul flow. Quand fournie, elle remplace la pagination du
  // nœud (nodeId/data ignorés). Cf. buildImpositionBlocks.
  spreadPages: { type: Array, default: null },
  // Trace la croix « maquette » (diagonales) sur l'empagement de chaque page —
  // réservé à l'aperçu de format (pages vides).
  bodyCross: { type: Boolean, default: false },
  // Pages NUES : ni papier, ni bordure, ni ombre, ni filet d'empagement. Le gabarit
  // (format, marges, titres courants) reste celui du livre, mais seul ce que les
  // blocs peignent est visible — cf. les lambeaux de recherche, qui portent leur
  // propre fond et leur découpe en style inline (`entries[].style`).
  barePages: { type: Boolean, default: false },
  // Debug : rendre visible le Quill flottant (sinon seul le miroir Folio l'est).
  quillVisible: { type: Boolean, default: false },
  // Molette = PAGINATION APPLICATIVE au lieu de défilement : la rangée ne porte
  // qu'une page, l'appelant lui donne la suivante (cf. les résultats de recherche,
  // paginés en amont pour ne pas couler des milliers de lambeaux dans Paged.js).
  wheelPaging: { type: Boolean, default: false },
})

// `step` : cran de pagination applicative demandé à la molette (±1), cf. wheelPaging.
const emit = defineEmits(['step'])

const rootRef = ref(null)
const frameRef = ref(null)
// La CustomScrollbar de la rangée de pages (mode édition uniquement) : remesurée
// après chaque fitScale, cf. onScaled ci-dessous.
const scrollbarRef = ref(null)
// Fond décoratif de la double-page (filet de reliure/planche), cf. updateSpreadBg.
const padBgRef = ref(null)

// Cale la trame de fond (mode spread) sur la géométrie SCALÉE des pages. Le fond
// couvre TOUTE la fenêtre (position: fixed, cf. CSS) : il n'a donc plus de boîte à
// mesurer, seulement une PÉRIODE et une PHASE par axe (le centre de la gouttière
// qui suit la 1re page, en coordonnées écran) — la grille reste alignée sur les
// pages tout en continuant au-delà d'elles, derrière la doc-bar et jusqu'au bas de
// la fenêtre. Rappelé à chaque onScaled et à chaque défilement de la planche.
function updateSpreadBg() {
  if (props.mode !== 'spread') return
  const bg = padBgRef.value
  const doc = frameDoc()
  const frame = frameRef.value
  if (!bg || !doc || !frame) return
  const pages = doc.querySelectorAll('.pagedjs_page')
  if (!pages.length) { bg.style.opacity = '0'; return }
  const first = pages[0]
  const r0 = first.getBoundingClientRect()
  // Période = page + gouttière. Mesurée entre deux pages quand elles existent ;
  // sinon déduite de la marge de la page — `getComputedStyle` rend une valeur de
  // MISE EN PAGE (avant transform), d'où le produit par l'échelle, alors qu'un
  // getBoundingClientRect est déjà scalé. Une seule page ne prive donc plus la
  // planche de sa trame.
  const period = pages.length > 1
    ? pages[1].getBoundingClientRect().left - r0.left
    : r0.width + (parseFloat(doc.defaultView.getComputedStyle(first).marginRight) || 0) * scaleRef.value
  // Le rect des pages est intra-iframe : seule la phase traverse la frontière
  // iframe↔écran, d'où frameRect (qui porte aussi le SPREAD_PAD réservé dedans).
  const frameRect = frame.getBoundingClientRect()
  // La gouttière (X) sert aussi d'entre-rang (Y) : la rangée est unique, mais la
  // trame horizontale se répète sur toute la fenêtre — tête et pied de page en
  // portent un filet, à la même distance que les reliures.
  const gutter = period - r0.width
  bg.style.setProperty('--pad-period', `${period}px`)
  bg.style.setProperty('--pad-phase', `${r0.left + frameRect.left + r0.width + gutter / 2}px`)
  bg.style.setProperty('--pad-period-y', `${r0.height + gutter}px`)
  bg.style.setProperty('--pad-phase-y', `${r0.top + frameRect.top + r0.height + gutter / 2}px`)
  bg.style.opacity = '1'
}

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
const hasContent = computed(() => !!item.value || (props.spreadPages?.length ?? 0) > 0)
const section = computed(() => (item.value ? { ...item.value, id: props.nodeId, depth: props.depth } : null))
const blocks = computed(() => {
  if (props.spreadPages) return buildImpositionBlocks(props.spreadPages)
  return section.value ? buildBlocks([section.value]) : []
})

const { scaleRef, scalePercent, fitScale } = useFolioScale(props, {
  rootRef,
  frameRef,
  frameDoc,
  // Le frame change de largeur/hauteur à chaque mise à l'échelle ; la
  // CustomScrollbar ne l'observe pas (seulement sa propre taille + les mutations
  // de contenu) → on la remesure. No-op en mode read (pas de scrollbar). En
  // double-page, on recale aussi le fond des gouttières sur la nouvelle échelle.
  onScaled: () => { scrollbarRef.value?.measure(); updateSpreadBg() },
})

const caret = useFakeCaret(findFragEl, frameOffset)
const toolbar = useFloatingToolbar()
const { cursorRect, selectionRects } = caret
const { registerToolbar } = toolbar

const { registry, fragments, buildFrame, refresh, teardown } = useFolioFrame(props, {
  frameRef,
  frameDoc,
  blocks,
  section,
  // Vider le curseur avant la repagination ; recaler l'échelle après. Le
  // double-buffer de useFolioFrame (pagination dans un tampon caché, swap en un
  // seul tick avec fitScale) évite tout flash/blanc — plus de masquage opacity ici.
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

// La molette au-dessus des pages naît dans le document de l'iframe (qui ne défile
// pas : overflow hidden) — on la relaie à la CustomScrollbar pour convertir le
// défilement vertical en horizontal sur la rangée de pages.
function onFrameWheel(e) {
  // Pagination applicative : rien à défiler, la molette change de page.
  if (props.wheelPaging) {
    e.preventDefault()
    const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0
    if (dir) emit('step', dir)
    return
  }
  scrollbarRef.value?.handleWheel(e)
  // La trame de fond est posée en coordonnées ÉCRAN (fixed) : défiler la planche
  // déplace les pages sous elle. `handleWheel` écrit `scrollLeft` de façon
  // synchrone, la mesure qui suit voit déjà la nouvelle position.
  updateSpreadBg()
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

// Listeners attachés au doc de l'iframe. Le getter passé à useFolioFrame les résout
// au (dé)montage : onColumnMouseDown/Up viennent de useFragmentEditor, onFrameClick
// d'ici. En `spread` on n'attache QUE la molette (relayée à la CustomScrollbar) —
// toujours, car `scroll` s'active APRÈS le montage (la frame n'est pas rebâtie) et
// le listener doit déjà être là ; il est inerte tant que rien ne déborde.
const editListeners = props.mode === 'edit'
  ? { click: onFrameClick, mousedown: onColumnMouseDown, mouseup: onColumnMouseUp, wheel: onFrameWheel }
  : props.mode === 'spread'
    ? { wheel: onFrameWheel }
    : null

onMounted(buildFrame)
onBeforeUnmount(teardown)

// Changement de nœud/niveau : repagine. L'édition, elle, repagine via refresh()
// (appelé par useFragmentEditor) — pas besoin d'observer le contenu ici, ce qui
// éviterait de repaginer deux fois après une frappe.
watch(() => [props.nodeId, props.depth, props.spreadPages, props.bodyCross, props.barePages], refresh)

// Changement d'apparence/césure (aperçu de config édité en direct) : repagine, mais
// DÉBOUNCÉ — la frappe dans un champ (corps, interligne) sinon repaginerait à chaque
// caractère, sur jusqu'à 3 iframes. `props.visuals` est un nouvel objet à chaque
// retouche (cf. effectiveVisuals), une comparaison de référence suffit.
let styleTimer = null
// `hyphenation.global` explicitement : dans la config il est muté EN PLACE (même
// référence d'objet), une comparaison de l'objet seul le raterait.
// `props.page` : nouvel objet à chaque changement de format (cf. previewPage,
// ConfigView) — même comparaison de référence que visuals. `runningTitles` est
// muté EN PLACE dans la config (comme hyphenation) : on surveille ses champs.
watch(() => [
  props.visuals, props.hyphenation, props.hyphenation?.global, props.page, props.margins,
  props.runningTitles, runningTitlesSignature(props.runningTitles), props.bookTitle,
], () => {
  if (!frameReadyForStyle()) return
  clearTimeout(styleTimer)
  styleTimer = setTimeout(refresh, 250)
})
onBeforeUnmount(() => clearTimeout(styleTimer))
// Évite une repagination avant le premier rendu (buildFrame s'en charge déjà).
function frameReadyForStyle() {
  return !!frameRef.value?.contentDocument
}

// Signature plate des titres courants : dans la config, `runningTitles` est muté
// EN PLACE (nested), une comparaison de référence raterait les changements. On
// sérialise les champs qui pilotent le rendu.
function runningTitlesSignature(rt) {
  if (!rt) return ''
  const band = (b) => (b ? `${b.enabled}|${b.recto}|${b.verso}|${b.heightCm}|${b.justification}` : '')
  return `${band(rt.header)}#${band(rt.footer)}`
}
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

/* Double-page (lecture) : hauteur venue du parent flex (indépendante du contenu
   → pas de boucle d'échelle, comme --edit), planche centrée, pages au-delà de la
   planche clippées. Le parent doit être une colonne flex qui lui donne une hauteur. */
.folio-view--spread {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.folio-scroll {
  width: 100%;
  height: 100%;
}

/* Double-page : la rangée est FERRÉE À GAUCHE (pas de respiration à gauche, la 1re
   page reste collée au bord) ; l'ombre portée a sa place via SPREAD_PAD réservé DANS
   la frame (cf. useFolioScale). Le défilement horizontal vit dans la CustomScrollbar. */
.folio-view--spread .folio-pad {
  padding: 0 16em;
}

/* Respiration généreuse autour de la rangée de pages (cf. EDIT_PAD, que fitScale
   retire de la place disponible). Portée par un wrapper shrink-wrap (width:max-content,
   pas inline-block : évite l'espace de baseline sous un inline-block, qui créerait un
   débordement vertical d'où une track parasite) pour que scrollWidth inclue les 40px
   des deux côtés. Le défilement lui-même est géré par la CustomScrollbar. */
.folio-pad {
  display: block;
  width: max-content;
  position: relative;
}

.folio-frame {
  display: block;
  width: 100%;
  border: 0;
}

/* Double-page : l'iframe passe AU-DESSUS du fond décoratif (elle est transparente
   dans les gouttières, qui laissent voir le filet derrière). */
.folio-view--spread .folio-frame {
  position: relative;
  z-index: 1;
}

/* Trame de fond (double-page) : fines pointillées figurant reliures ET frontières
   de planches, en GRILLE (verticales = gouttières entre pages, horizontales = tête
   et pied). `position: fixed` : elle couvre TOUTE la fenêtre — elle passe donc
   derrière la doc-bar et descend jusqu'en bas, au-delà de la planche, et échappe à
   l'`overflow: hidden` de la vue (aucun ancêtre ne porte de transform/filter, qui
   referait de la frame le référentiel du fixed). La grille reste calée sur les
   pages par `--pad-period*` / `--pad-phase*`, posées en JS (updateSpreadBg) sur la
   géométrie scalée.
   Les deux axes vivent dans DEUX pseudo-éléments et non deux couches de fond : le
   pointillé se fait au `mask`, qui s'applique à l'élément entier — le mask
   horizontal des verticales hacherait les horizontales. */
.folio-pad-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0; /* révélé par JS une fois périodes/phases calées (≥ 1 page) */
  /* ── Réglages ── */
  /* Bleu profond du menu, très dilué : la trame se devine sans jamais concurrencer
     le texte des pages. (Élément hors iframe → les tokens du DS sont résolus.) */
  --pad-color: color-mix(in srgb, var(--c-accent-alt-darker) 22%, transparent);
  --pad-line: 1px;      /* épaisseur du filet */
  --pad-dash: 2px;      /* longueur d'un tiret */
  --pad-gap: 3px;       /* espace entre tirets */
  /* ── Posés par JS ── */
  --pad-period: 0px;    /* page + gouttière, axe X */
  --pad-phase: 0px;     /* centre de la 1re gouttière, en coordonnées écran */
  --pad-period-y: 0px;  /* page + gouttière, axe Y */
  --pad-phase-y: 0px;
}

/* Les deux axes partagent tout sauf leur direction : un tile d'EXACTEMENT une
   période (et non un `repeating-linear-gradient` étalé sur toute la boîte, dont la
   copie de gauche redémarrait à une phase arbitraire → filet parasite dans la
   première page), et un mask perpendiculaire qui le découpe en pointillé. */
.folio-pad-bg::before,
.folio-pad-bg::after {
  content: "";
  position: absolute;
  inset: 0;
}

.folio-pad-bg::before {
  background-image: linear-gradient(
    to right,
    var(--pad-color) 0,
    var(--pad-color) var(--pad-line),
    transparent var(--pad-line)
  );
  background-size: var(--pad-period) 100%;
  background-position-x: calc(var(--pad-phase) - var(--pad-line) / 2);
  -webkit-mask-image: repeating-linear-gradient(
    to bottom, #000 0, #000 var(--pad-dash),
    transparent var(--pad-dash), transparent calc(var(--pad-dash) + var(--pad-gap))
  );
  mask-image: repeating-linear-gradient(
    to bottom, #000 0, #000 var(--pad-dash),
    transparent var(--pad-dash), transparent calc(var(--pad-dash) + var(--pad-gap))
  );
}

.folio-pad-bg::after {
  background-image: linear-gradient(
    to bottom,
    var(--pad-color) 0,
    var(--pad-color) var(--pad-line),
    transparent var(--pad-line)
  );
  background-size: 100% var(--pad-period-y);
  background-position-y: calc(var(--pad-phase-y) - var(--pad-line) / 2);
  -webkit-mask-image: repeating-linear-gradient(
    to right, #000 0, #000 var(--pad-dash),
    transparent var(--pad-dash), transparent calc(var(--pad-dash) + var(--pad-gap))
  );
  mask-image: repeating-linear-gradient(
    to right, #000 0, #000 var(--pad-dash),
    transparent var(--pad-dash), transparent calc(var(--pad-dash) + var(--pad-gap))
  );
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
