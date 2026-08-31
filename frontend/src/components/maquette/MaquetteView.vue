<template>
  <div class="maquette">
    <MaquetteBar
        :zoom="zoom"
        :zooms="ZOOMS"
        :tally-row="activeTallyRow"
        :validating="validating"
        :recalibratable="recalibratable"
        :searching="searching"
        :presentation-mode="presentationMode"
        :available-modes="availableModes"
        :show-presentation-select="showPresentationSelect"
        @validate="toggleValidation"
        @recalibrate="startRecalibration"
        @update:zoom="zoom = $event"
        @update:presentation-mode="setPresentationMode"
        @focus-search="enterSearch"
        @exit-search="exitSearch"
        @update:query="onQuery"
    />

    <RecalibrationModal
        :open="recalOpen"
        :starting="recalStarting"
        :recal-error="recalErr"
        :preview="recalPreview"
        :shifted-start-index="shiftedStartIndex"
        @close="closeRecal"
        @committed="onRecalCommitted"
    />

    <MaquetteRecalReport :report="recalReport" @close="recalReport = null" />

    <MaquetteStructureNav
        :groups="navGroups"
        :active-series-key="focusedCran?.seriesKey ?? null"
        :trame="trame"
        :data="documentData"
        :node-id="mainNodeId"
        :liminaire-pages="liminairePages"
        :lim-types="limTypes"
        :lim-suggestions="limSuggestions"
        @focus-series="focusSeries"
        @select-node="selectNode"
        @set-lim-type="limSetType"
    >

      <template #footer>
        <MaquetteAccordeon
            v-model:folds="folds"
            collapse-on-leave
            :crans="crans"
            :focused="focused"
            :ratio="previewRatio"
            @update:focused="focused = $event"
        >
          <template #spread="{ cran }">
            <MaquetteAnalyseCell
                v-if="cran.sourceKey === 'analyse'"
                :label="cran.analyseLabel"
                :ratio="previewRatio"
            />
            <PageDiagram
                v-else-if="cran.sourceKey === 'maquette'"
                class="maq-format-cell"
                :page-size="previewPage"
                :margins="previewMargins"
                :running-titles="styleDefaults.runningTitles"
            />
            <MaquetteLiminaireCell
                v-else-if="cran.sourceKey === 'liminaire' && limSpreads[cran.spreadIndex]"
                :spread="limSpreads[cran.spreadIndex]"
                :types="limTypes"
                :suggestions="limSuggestions"
                :ratio="previewRatio"
            />
            <MaquetteChapitreCell
                v-else-if="cran.sourceKey === 'chapitrage'"
                :depth-key="cran.depthKey"
                :ratio="previewRatio"
            />
            <MaquetteSpreadCell v-else :ratio="previewRatio" />
          </template>
        </MaquetteAccordeon>
      </template>
    </MaquetteStructureNav>

    <div class="maquette__left">
      <div class="maquette__panels">

        <section class="maquette__main">
          <div
              class="folio-stage"
              :class="{
                'folio-stage--lim': isLiminaire,
                'folio-stage--search': searchLayout,
              }"
          >
            <div class="folio-col">
              <!-- Slide à deux planches : deux slots A/B (ping-pong). Le slot vivant porte
                   la vue courante ; l'autre, pendant une bascule, la vue sortante figée.
                   Chaque FolioView a sa trame en `bg-scope="local"` (bornée à la planche,
                   sinon deux trames `fixed` se peindraient sur toute la fenêtre). -->
              <div class="folio-slider">
                <div
                    v-for="slot in ['a', 'b']"
                    :key="slot"
                    class="folio-slot"
                    :style="shiftStyle(slot)"
                >
                  <FolioView
                      v-if="bundleFor(slot)"
                      class="maq-folio"
                      mode="spread"
                      bg-scope="local"
                      v-bind="bundleFor(slot)"
                      :data="documentData"
                      :visuals="effectiveVisuals"
                      :emit-token="emitToken"
                      @step="(d) => onSlotStep(slot, d)"
                      @paginated="onSlotPaginated(slot)"
                      @spread-geometry="(g) => onSlotSpread(slot, g)"
                      @block-geometry="(g) => onSlotBlock(slot, g)"
                      @style-geometry="(g) => onSlotStyle(slot, g)"
                  />
                  <!-- Callouts ancrés au folio, DANS le slot : le transform du slot les
                       fait glisser avec sa planche. Affichés dès que CE slot a paginé
                       (géométrie fraîche) → pas d'ancrage sur des rects périmés. -->
                  <MaquetteCallouts
                      v-if="calloutsFor(slot) && slotGeo[slot].spread?.pages?.length"
                      :view="calloutsFor(slot)"
                      :geometry="slotGeo[slot]"
                      :interactive="slot === liveSlot"
                  />
                </div>
              </div>
              <!-- Scènes frag (nuage / validation) : dans la COQUILLE (pas les panes) pour
                   survivre au routeur et glisser en entrée ET sortie. `fragScene` donne la
                   scène à montrer (vivante, sinon sortante figée) + son transform. -->
              <template v-if="fragScene">
                <MaquetteAnalyseScene
                    v-if="fragScene.scene.kind === 'analyse'"
                    :slide-style="fragScene.style"
                    :scene="fragScene.scene"
                />
                <MaquetteValidationScene
                    v-else-if="fragScene.scene.kind === 'validation'"
                    :slide-style="fragScene.style"
                    :scene="fragScene.scene"
                />
              </template>
              <router-view />
            </div>
          </div>
        </section>
      </div>

    </div>

    <StyleEditorPanel
        :style-name="editingStyle"
        :base="editingStyle ? styleBase[editingStyle] : null"
        :overrides="styleOverrides"
        :geometry="spreadGeometry"
        :anchor-rect="editingStyle ? styleGeometry[editingStyle] ?? null : null"
        @close="editingStyle = null"
    />
  </div>
</template>

<script setup>
// Coquille : injecte l'état document, instancie les composables et les câble au
// template + au modèle partagé des panes (provide('maq')). Aucune logique métier ici.
import { ref, reactive, computed, inject, provide, onMounted, onUnmounted, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import MaquetteAccordeon from './MaquetteAccordeon.vue'
import MaquetteCallouts from './MaquetteCallouts.vue'
import MaquetteSpreadCell from './MaquetteSpreadCell.vue'
import MaquetteLiminaireCell from './MaquetteLiminaireCell.vue'
import MaquetteChapitreCell from './MaquetteChapitreCell.vue'
import MaquetteAnalyseCell from './MaquetteAnalyseCell.vue'
import MaquetteStructureNav from './MaquetteStructureNav.vue'
import MaquetteBar from './MaquetteBar.vue'
import MaquetteRecalReport from './MaquetteRecalReport.vue'
import FolioView from '../editor/FolioView.vue'
import MaquetteAnalyseScene from './MaquetteAnalyseScene.vue'
import MaquetteValidationScene from './MaquetteValidationScene.vue'
import PageDiagram from '../config/PageDiagram.vue'
import StyleEditorPanel from '../config/StyleEditorPanel.vue'
import RecalibrationModal from '../config/RecalibrationModal.vue'
import { spreadStyles } from '../../script/liminaire-styles'
import { computeImposition } from '../../script/liminaire-imposition'
import { analyseLayers } from '../../script/analyseSections'
import { ANALYSE_CARDS } from '../analyse/analyseCards'
import { useTypologyConfig } from '../../composables/useTypologyConfig'
import { useRegistry } from '../../composables/useRegistry'
import { useRecalibration } from '../../composables/useRecalibration'
import { useLiminaireBornes } from '../../composables/useLiminaireBornes'
import { useLiminaireComposition } from '../../composables/useLiminaireComposition'
import { useAnalyse } from '../../composables/useAnalyse'
import { useDocStats } from '../../composables/useDocStats'
import { useMaquetteFilm } from '../../composables/useMaquetteFilm'
import { useMaquetteSearch } from '../../composables/useMaquetteSearch'
import { useChapitrageModel } from '../../composables/useChapitrageModel'
import { useMaquetteFolio } from '../../composables/useMaquetteFolio'
import { useMaquetteSlide } from '../../composables/useMaquetteSlide'
import { useMaquetteRoute } from '../../composables/useMaquetteRoute'
import { usePresentationMode } from '../../composables/usePresentationMode'
import { chapitrageTornPages, liminaireTornPages } from '../../script/tornFragments'
import { effectiveMargins } from '../../script/pageFormats'

const route = useRoute()

const trame = inject('documentTrame', null)
const documentData = inject('documentData', null)
const documentTitle = inject('documentTitle', null)
const documentPageOdt = inject('documentPageOdt', null)
const reloadDocument = inject('reloadDocument', null)

const {
  styles, rules, liminaireConfig, styleDefaults, sections,
  inventory, highlights, zoned, structureShapes,
  styleOverrides, styleBase, effectiveVisuals, saving, stylePrecedence,
  toggleRequireStyle, toggleAdjacency, addDeclaredStyle, removeDeclaredStyle,
  load, save,
} = useTypologyConfig()

onMounted(() => { if (route.params.id) load(route.params.id) })

const bookTitle = computed(() => documentTitle?.value ?? '')
const fmtPage = computed(() => documentPageOdt?.value ?? null)

// Injections attendues par StyleRolesTable / StyleEditorPanel (copiées de ConfigView).
const editingStyle = ref(null)
provide('openStyleEditor', (name) => { editingStyle.value = name })
provide('styleOverrides', styleOverrides)
provide('stylePrecedence', stylePrecedence)
provide('toggleRequireStyle', toggleRequireStyle)
provide('toggleAdjacency', toggleAdjacency)
provide('addDeclaredStyle', addDeclaredStyle)
provide('removeDeclaredStyle', removeDeclaredStyle)

const { liminairePages, borderShift: limBorderShift } =
  useLiminaireBornes(trame, documentData, liminaireConfig)

// Disposition EFFECTIVE par style (1re occurrence de chaque style dans le liminaire) :
// l'élément d'ouverture d'une page vaut 'blank' (belle page) s'il est précédé d'une vraie
// blanche, sinon 'break' (saut) ; un élément qui coule au milieu d'une page vaut 'none'
// (continu). Reflète .odt ET overrides (liminairePages consomme déjà la config) → c'est
// ce que le select AFFICHE ; le régler écrit `liminaireConfig[clé].disposition`.
const limDispositionByStyle = computed(() => {
  const slots = computeImposition(liminairePages.value)
  const out = {}
  const seen = new Set()
  slots.forEach((s, i) => {
    if (s.blank || !s.page) return
    const prev = slots[i - 1]
    const blankBefore = !!(prev && prev.blank && !prev.cover)
    const entries = s.page.entries || []
    const openerIdx = entries.findIndex((e) => !e.isBlank)
    entries.forEach((e, ei) => {
      if (e.isBlank || !e.styleName || seen.has(e.styleName)) return
      seen.add(e.styleName)
      out[e.styleName] = {
        key: e.key,
        disposition: ei === openerIdx
          ? (blankBefore || s.page.precedes === 'blank' ? 'blank' : 'break')
          : 'none',
      }
    })
  })
  return out
})

const { documents, ensureLoaded, fetchDocuments } = useRegistry()
onMounted(ensureLoaded)

const docId = computed(() => route.params.id)
const {
  preview: recalPreview, report: recalReport, recalOpen, starting: recalStarting,
  recalError: recalErr, shiftedStartIndex,
  startRecalibration, closeRecal, finishCommit,
} = useRecalibration({ docId, borderShift: limBorderShift })

// hasSource absent (import avant DocumentSource) → recalibrage barré ; le 404 backend
// reste le filet le temps que le registre charge.
const currentDoc = computed(() => documents.value.find((d) => d.id === route.params.id) ?? null)
const recalibratable = computed(() => currentDoc.value?.hasSource !== false)

async function onRecalCommitted(summary) {
  finishCommit(summary)
  await fetchDocuments()
  reloadDocument?.()
  await load(route.params.id)
}

// Révélation DANS le setup (pas au montage) : la liste des calques en dépend et doit
// être arrêtée avant qu'on ne pose le cran focusé.
const { isRevealed, revealAll } = useAnalyse()
revealAll()
const layers = computed(() => analyseLayers(isRevealed))

// Le focus liminaire vit dans useMaquetteFilm : les sorties focus-dépendantes de la
// composition ne sont pas consommées ici, d'où le getter neutre.
const {
  spreads: limSpreads, types: limTypes, suggestions: limSuggestions, onSetType: limSetType,
} = useLiminaireComposition({
  pages: () => liminairePages.value,
  config: () => liminaireConfig,
  title: () => bookTitle.value,
  focused: () => 0,
})

// Calculé en amont du film (il en construit ses crans) et lu par useChapitrageModel.
const chapSections = computed(() =>
  sections.value
    .filter((s) => s.depthKey !== null)
    .map((s) => ({ ...s, ruleSet: rules.byDepth[s.depthKey] ?? null, defaultRuleSet: rules.default })),
)

const {
  focused, crans, focusedCran, focusedSourceKey,
  isFormat, isLiminaire, isChapitrage, searching,
  folds, vocabIndex, enterSearch, exitSearch,
  parts, focusSeries, onAsideWheel, selectNode,
  limStart, limFocused, setLimFocused, limFocusedSpread,
} = useMaquetteFilm({ layers, limSpreads, chapSections, bookTitle, trame })

const { presentationMode, availableModes, showPresentationSelect, setPresentationMode } =
  usePresentationMode({ focusedSourceKey })

// Jalons du sommaire pour la nav : Format · Liminaire (dépliable → pages) · dossier
// Chapitrage (dépliable → une page par niveau, « Chapitrage n°x ») · Annotations.
const navGroups = computed(() => {
  const out = []
  parts.value.forEach((p) => {
    if (p.key === 'liminaire') out.push({ key: p.key, label: p.label, kind: 'liminaire' })
    else if (p.key === 'validation') out.push({ key: p.key, label: p.label, kind: 'annotations' })
    else if (p.key.startsWith('chap-')) {
      let g = out.find((x) => x.kind === 'chapitrage')
      if (!g) { g = { key: 'chapitrage', label: 'Chapitrage', kind: 'chapitrage', levels: [] }; out.push(g) }
      g.levels.push({ key: p.key, label: p.label })
    } else out.push({ key: p.key, label: p.label, kind: 'leaf' })
  })
  return out
})

const liminaireInventory = computed(
  () => sections.value.find((s) => s.zone.key === 'liminaire')?.styles ?? [],
)
const limSpreadStyles = computed(() => spreadStyles(limFocusedSpread.value, liminaireInventory.value))

const {
  focusedSection, modelNodeId, activeTallyRow,
  validating, toggleValidation,
  deviationGroups, showGroupes, hoveredGroup, onHoverGroup, hoveredNode,
  mergeSuggestion, corpsSuggestion, styleRows, merging, applyMerge,
} = useChapitrageModel({
  trame, documentData, chapSections, rules, structureShapes,
  styles, stylePrecedence, focusedCran, searching, load,
})

const { statItems } = useDocStats()

// « Aperçu déchiré » : pages d'imposition FIDÈLES (tête titre→1er paragraphe + lambeaux
// des styles supplémentaires), coulées dans le MÊME FolioView que recherche/annotations.
// Calculé sans dépendre de styleGeometry (qui, en pouring, ne reflète plus le nœud).
const tornActive = computed(
  () => presentationMode.value === 'torn' && (isChapitrage.value || isLiminaire.value),
)
// Marges du livre, calculées ici (indépendamment de useMaquetteFolio, appelé APRÈS et qui
// consomme tornPages) : reportées dans le padding des feuilles déchirées.
const tornMargins = computed(() => effectiveMargins(fmtPage.value, styleDefaults.pageMargins))
const tornPages = computed(() => {
  if (!tornActive.value) return []
  if (isLiminaire.value) return liminaireTornPages(limSpreads.value, tornMargins.value)
  return chapitrageTornPages(trame?.value?.axes, documentData?.value, focusedSection.value?.depthKey, tornMargins.value)
})

const {
  onQuery, pouring, activeNeedle,
  resultPage, resultPageCount, resultOffset, pageFragments, stepResultPage, pourTitle,
  mutedColors, toggleMutedColor, annotationCharCounts,
} = useMaquetteSearch({ searching, focusedSourceKey, highlights, tornActive })

const focusedLayer = computed(() => layers.value.find((l) => l.key === focusedCran.value?.analyseKey) ?? null)
const isCloudView = computed(() => focusedLayer.value?.key === 'vocabulaire')
const analyseCards = computed(() =>
  (focusedLayer.value?.sections ?? [])
    .map((s) => ({ key: s.key, comp: ANALYSE_CARDS[s.key] }))
    .filter((c) => c.comp),
)

const {
  spreadGeometry, blockGeometry, styleGeometry,
  geometryStale, searchLayout, annotationsLayout,
  onSpreadGeometry, onPaginated,
  analyseLeft, analyseColumn,
  previewPage, previewMargins, previewRunningTitles, previewRatio, mainPage, pourPeriodRatio,
  mainSpreadPages, mainNodeId, mainDepth,
  chapSpreadStyles, hoveredStyle, setHoveredStyle,
} = useMaquetteFolio({
  fmtPage, styleDefaults, searching, focusedSourceKey, isFormat, isLiminaire,
  limFocusedSpread, pouring, pageFragments, activeNeedle, pourTitle, resultOffset,
  statItems, modelNodeId, focusedSection, limFocused, focused,
  tornActive, tornPages,
})

// Réglage permanent : ×1 = planche d'ouverture (2 pages), ×3 = 6 pages de large. Seul
// réglage de `visible-pages` (le faire varier par cran figeait l'échelle en recherche).
const ZOOMS = [1, 2, 3, 4, 6]
const zoom = ref(1)
// Marges @page nulles pour l'aperçu déchiré (les feuilles portent les marges en padding).
const TORN_NO_MARGINS = { topCm: 0, bottomCm: 0, innerCm: 0, outerCm: 0 }
// Empan réservé aux vues à vis-à-vis : 2 pages (2·zoom) + 2 rails (side-rails=1) =
// 2·zoom + 2 périodes-livre. C'est lui qui fixe l'échelle (px/cm).
const spreadSpanPeriods = computed(() => 2 * zoom.value + 2)
// En pouring (lambeaux) : on réserve le MÊME empan, mais compté en périodes de la page
// LARGE (side-rails=0, ferrage à gauche) → l'échelle reste CALIBRÉE sur celle de Format
// au lieu de laisser la page grossir jusqu'à remplir la hauteur.
const folioVisiblePages = computed(() =>
  pouring.value && !tornActive.value ? spreadSpanPeriods.value / pourPeriodRatio.value : 2 * zoom.value,
)

// La vue COURANTE en un objet `{ bundle, scene }` — l'unité que le slide fige pour la
// planche + scène SORTANTES (cf. useMaquetteSlide). `bundle` = props FolioView ; `scene` =
// ce dont l'aside frag a besoin (kind + isCloudView), figé pour glisser dehors avec son
// contenu. `data`/`visuals` (le document entier, identique d'une vue à l'autre) et
// `emit-token` restent passés à part.
const liveView = computed(() => {
  // `bareLayout` : planche NUE ferrée à gauche et ÉLARGIE (recherche/annotations). Le
  // torn en est exclu → il garde le VIS-À-VIS de la vue par défaut (page 1 centrée à la
  // même position, largeur livre, rails). Mais il reste en pages TRANSPARENTES
  // (`barePages`) : pas de papier blanc, la trame de fond se voit — le morceau déchiré s'y
  // détache. Seul le contenu diffère (spreadPages = pages déchirées).
  const bareLayout = pouring.value && !tornActive.value
  return {
  bundle: {
    visiblePages: folioVisiblePages.value,
    sideRails: bareLayout ? 0 : 1,
    spreadAlign: bareLayout ? 'start' : 'center',
    bodyCross: isFormat.value,
    barePages: pouring.value,
    clampEntries: isLiminaire.value && !pouring.value,
    capPages: isChapitrage.value && !pouring.value ? 2 : 0,
    wheelPaging: pouring.value,
    spreadPages: mainSpreadPages.value,
    nodeId: mainNodeId.value,
    depth: mainDepth.value,
    page: mainPage.value,
    // Torn : marges @page à 0 → le contenu remplit la page, et les feuilles déchirées
    // portent elles-mêmes les marges du livre (padding, cf. tornFragments) → chaque
    // lambeau est un vrai morceau de page, texte encné comme dans le livre.
    margins: tornActive.value ? TORN_NO_MARGINS : previewMargins.value,
    hyphenation: styleDefaults.hyphenation,
    runningTitles: pouring.value ? null : previewRunningTitles.value,
    bookTitle: pouring.value ? '' : bookTitle.value,
    highlightStyle: hoveredStyle.value,
  },
  scene: {
    kind: searching.value ? 'analyse' : (focusedSourceKey.value === 'validation' ? 'validation' : null),
    isCloudView: isCloudView.value,
    // Ancrage horizontal FIGÉ avec la vue : la scène sortante garde sa colonne pendant
    // qu'elle glisse dehors (sinon elle prendrait l'analyseLeft de la vue entrante).
    analyseLeft: analyseLeft.value,
    analyseColumn: analyseColumn.value,
  },
  // Descriptif des callouts ancrés au folio, FIGÉ avec la vue : les données PAR-vis-à-vis
  // (styles du spread, spread liminaire, section) changent d'un cran à l'autre, il faut
  // les figer pour que la planche sortante garde SES callouts. Le reste (rôles, types,
  // config…) est stable sur la durée d'un slide → injecté en direct par MaquetteCallouts.
  callouts: calloutsDescriptor(),
  }
})

// Snapshot des données par-vis-à-vis dont les callouts d'un slot ont besoin, selon la
// source. Lu DANS liveView (donc figé avec elle par le slide). Les vues sans callouts
// ancrés au folio (analyse/validation) ne portent qu'une source → overlay vide.
function calloutsDescriptor() {
  const source = focusedSourceKey.value
  if (source === 'maquette') return { source }
  if (source === 'liminaire') {
    return { source, limStyles: limSpreadStyles.value, limSpread: limFocusedSpread.value }
  }
  if (source === 'chapitrage') {
    return { source, chapStyles: chapSpreadStyles.value, section: focusedSection.value }
  }
  return { source }
}

const { liveSlot, bundleFor, calloutsFor, onSlotPaginated, shiftStyle, emitToken, fragScene } = useMaquetteSlide({
  focused, liveView, markSettled: onPaginated,
})

// Géométrie émise PAR SLOT : chaque overlay de callouts est monté DANS son `.folio-slot`
// et se recale sur la planche de CE slot — la sortante figée garde donc sa géométrie de
// repos (émise avant la bascule) et glisse dehors avec, l'entrante emménage avec la sienne.
// (Les refs partagées, elles, ne suivent que la planche VIVANTE : StyleEditorPanel / scènes
// s'y ancrent, et la figée sortante y serait périmée / hors écran.)
const slotGeo = reactive({
  a: { spread: null, block: [], style: {} },
  b: { spread: null, block: [], style: {} },
})
const onSlotStep = (slot, d) => { if (slot === liveSlot.value) stepResultPage(d) }
const onSlotSpread = (slot, g) => { slotGeo[slot].spread = g; if (slot === liveSlot.value) onSpreadGeometry(g) }
const onSlotBlock = (slot, g) => { slotGeo[slot].block = g; if (slot === liveSlot.value) blockGeometry.value = g }
const onSlotStyle = (slot, g) => { slotGeo[slot].style = g; if (slot === liveSlot.value) styleGeometry.value = g }

useMaquetteRoute({ focused, crans, focusedCran, vocabIndex, limStart, limSpreads })

const barAction = inject('documentBarAction', null)
watchEffect(() => {
  if (!barAction) return
  barAction.value = {
    label: 'Enregistrer',
    icon: 'pi-save',
    busy: saving.value,
    run: () => save(route.params.id),
  }
})
onUnmounted(() => { if (barAction) barAction.value = null })

provide('maq', {
  fmtPage, styleDefaults, spreadGeometry, presentationMode,
  styleGeometry, blockGeometry, styles, limSpreadStyles, limFocusedSpread,
  limTypes, limSuggestions, liminaireConfig, limFocused, limSpreads,
  limSetType, setLimFocused, setHoveredStyle, limDispositionByStyle,
  rules, focusedSection, chapSpreadStyles, mainDepth, effectiveVisuals, previewRatio,
  showGroupes, hoveredNode, hoveredGroup, deviationGroups, mergeSuggestion,
  corpsSuggestion, merging, styleRows, onHoverGroup, applyMerge,
  inventory, highlights, zoned, focusedCran, onAsideWheel,
  annotationsLayout, annotationCharCounts, mutedColors, toggleMutedColor,
  searchLayout, resultPage, resultPageCount, stepResultPage,
  analyseLeft, analyseColumn, isCloudView, analyseCards, focusedLayer,
  geometryStale,
})
</script>

<style scoped>
/* Rangée : colonne gauche (aperçu + dock, sous la doc-bar) · sommaire flottant. La
   page ne scrolle pas globalement. Les customs vars sont hissées ici pour être vues à
   la fois par la colonne gauche et par le volet groupes ferré au viewport. */
.maquette {
  --maq-gutter: 15em;
  --maq-dock-h: 11.8em;
  --maq-groupes-h: 48vh;
  position: relative;
  display: flex;
  align-items: stretch;
  gap: var(--sp-4);
  height: 100%;
  overflow: hidden;
}

/* Ombre PORTÉE sur le fond par la barre — récepteur « loin » : bande profonde,
   sombre, sous la barre et À DROITE du sommaire (left: gouttière). Le sommaire
   (z 160) la recouvre à gauche avec son propre liseré clair (.maq-nav::before) →
   gauche = proche/clair, droite = loin/sombre. Sous la barre (z 170) et sous nav. */
.maquette::before {
  content: '';
  position: absolute;
  top: calc(var(--bar-size-2) + var(--bar-size));
  left: var(--maq-gutter);
  right: 0;
  height: 3em;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(to bottom,
      var(--c-shadow-1) 0%,
      var(--c-shadow-2) 20%,
      transparent
  );
}

/* Le dock flotte au bord gauche (pied du sommaire), pas ici : l'aperçu ne lui réserve
   plus de bande, il prend toute la hauteur et se retire de la gouttière du sommaire. */
.maquette__left {
  flex: 2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /*padding-top: calc(2 * var(--bar-size) + 1em);*/
  /*padding-left: var(--maq-gutter);*/
  padding-bottom: 5em;
}

.maquette__panels {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.maquette__main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  flex: 1 1 auto;
  min-height: 0;
  padding-top: 1em;
}

/* Slider du slide à deux planches : conteneur de référence des deux slots (absolus,
   plein cadre). `overflow: hidden` borne les planches à la scène → la planche entrante
   glisse depuis le bord au lieu de déborder. */
.folio-slider {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

/* Un slot = une planche, décalée par son propre transform (cf. shiftStyle). Colonne flex
   pour donner sa hauteur à la FolioView (flex:1). `.maquette__left` a perdu ses
   `padding-top`/`padding-left` (barres + sommaire passés en overlay opaque+blur) — on les
   répercute ICI en réservant le haut (barres) et la gauche (sommaire) : l'échelle du folio
   rétrécit d'autant et la planche garde sa position finale, sans passer sous les barres/le
   sommaire. */
.folio-slot {
  position: absolute;
  top: calc(2 * var(--bar-size) + 1em);
  right: 0;
  bottom: 0;
  left: var(--maq-gutter);
  display: flex;
  flex-direction: column;
}

.maq-folio {
  flex: 1 1 auto;
  min-height: 0;
}

/* Scène du FolioView unique : repère de l'overlay absolu des contrôles liminaire
   (montés par le pane routé). Hauteur bornée iso pour toutes les sources → échelle iso. */
.folio-stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.folio-col {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

/* Aperçu de page dans la cellule d'accordéon : ajusté sur la hauteur du cran. */
.maq-format-cell {
  height: 100%;
  margin: 0;
}

.maq-format-cell :deep(svg) {
  height: 100%;
  width: auto;
  max-width: none;
}

</style>
