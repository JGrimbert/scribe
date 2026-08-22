<template>
  <div class="maquette">
    <MaquetteBar
        :zoom="zoom"
        :zooms="ZOOMS"
        :tally-row="activeTallyRow"
        :validating="validating"
        :recalibratable="recalibratable"
        :searching="searching"
        :is-chapitrage="isChapitrage"
        :presentation-mode="presentationMode"
        @validate="toggleValidation"
        @recalibrate="startRecalibration"
        @update:zoom="zoom = $event"
        @focus-search="enterSearch"
        @exit-search="exitSearch"
        @update:query="onQuery"
        @update:presentation-mode="presentationMode = $event"
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
                'folio-stage--viz': isChapitrage && presentationMode === 'visualization',
              }"
          >
            <div v-if="isChapitrage && presentationMode === 'visualization'" class="folio-col folio-col--viz">
              <MaquetteVisualizationOverlay
                  :presentation-mode="presentationMode"
                  :visible-styles="visibleStylesOnPage1"
                  :chapitre-styles="allChapitreStyles"
              >
                <template #folio>
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
                    </div>
                  </div>
                </template>
              </MaquetteVisualizationOverlay>
            </div>
            <div v-else class="folio-col">
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
                </div>
              </div>
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
import { ref, computed, inject, provide, onMounted, onUnmounted, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import MaquetteAccordeon from './MaquetteAccordeon.vue'
import MaquetteSpreadCell from './MaquetteSpreadCell.vue'
import MaquetteLiminaireCell from './MaquetteLiminaireCell.vue'
import MaquetteChapitreCell from './MaquetteChapitreCell.vue'
import MaquetteAnalyseCell from './MaquetteAnalyseCell.vue'
import MaquetteStructureNav from './MaquetteStructureNav.vue'
import MaquetteBar from './MaquetteBar.vue'
import MaquetteRecalReport from './MaquetteRecalReport.vue'
import MaquetteVisualizationOverlay from './MaquetteVisualizationOverlay.vue'
import FolioView from '../editor/FolioView.vue'
import MaquetteAnalyseScene from './MaquetteAnalyseScene.vue'
import MaquetteValidationScene from './MaquetteValidationScene.vue'
import PageDiagram from '../config/PageDiagram.vue'
import StyleEditorPanel from '../config/StyleEditorPanel.vue'
import RecalibrationModal from '../config/RecalibrationModal.vue'
import { spreadStyles } from '../../script/liminaire-styles'
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

const precedesOf = (styleName) => stylePrecedence[styleName] ?? 'none'

onMounted(() => { if (route.params.id) load(route.params.id) })

const bookTitle = computed(() => documentTitle?.value ?? '')
const fmtPage = computed(() => documentPageOdt?.value ?? null)

const editingStyle = ref(null)
provide('openStyleEditor', (name) => { editingStyle.value = name })
provide('styleOverrides', styleOverrides)
provide('stylePrecedence', stylePrecedence)
provide('toggleRequireStyle', toggleRequireStyle)
provide('toggleAdjacency', toggleAdjacency)
provide('addDeclaredStyle', addDeclaredStyle)
provide('removeDeclaredStyle', removeDeclaredStyle)

const { liminairePages, borderShift: limBorderShift } =
  useLiminaireBornes(trame, documentData, liminaireConfig, precedesOf)

const { documents, ensureLoaded, fetchDocuments } = useRegistry()
onMounted(ensureLoaded)

const docId = computed(() => route.params.id)
const {
  preview: recalPreview, report: recalReport, recalOpen, starting: recalStarting,
  recalError: recalErr, shiftedStartIndex,
  startRecalibration, closeRecal, finishCommit,
} = useRecalibration({ docId, borderShift: limBorderShift })

const currentDoc = computed(() => documents.value.find((d) => d.id === route.params.id) ?? null)
const recalibratable = computed(() => currentDoc.value?.hasSource !== false)

async function onRecalCommitted(summary) {
  finishCommit(summary)
  await fetchDocuments()
  reloadDocument?.()
  await load(route.params.id)
}

const { isRevealed, revealAll } = useAnalyse()
revealAll()
const layers = computed(() => analyseLayers(isRevealed))

const {
  spreads: limSpreads, types: limTypes, suggestions: limSuggestions, onSetType: limSetType,
} = useLiminaireComposition({
  pages: () => liminairePages.value,
  config: () => liminaireConfig,
  title: () => bookTitle.value,
  focused: () => 0,
})

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

const {
  onQuery, pouring, activeNeedle,
  resultPage, resultPageCount, resultOffset, pageFragments, stepResultPage, pourTitle,
  mutedColors, toggleMutedColor, annotationCharCounts,
} = useMaquetteSearch({ searching, focusedSourceKey, highlights })

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
})

const ZOOMS = [1, 2, 3, 4, 6]
const zoom = ref(1)
const presentationMode = ref('standard')

// Styles du chapitre actif et visible sur page 1
const allChapitreStyles = computed(() => {
  const section = documentData?.[mainNodeId.value]
  return section?.styles?.map((s) => s.key) ?? []
})

const visibleStylesOnPage1 = computed(() => {
  const keys = Object.keys(styleGeometry.value || {})
  return keys.filter((key) => styleGeometry.value[key] != null)
})

const spreadSpanPeriods = computed(() => 2 * zoom.value + 2)
const folioVisiblePages = computed(() =>
  pouring.value ? spreadSpanPeriods.value / pourPeriodRatio.value : 2 * zoom.value,
)

const liveView = computed(() => ({
  bundle: {
    visiblePages: folioVisiblePages.value,
    sideRails: pouring.value ? 0 : 1,
    spreadAlign: pouring.value ? 'start' : 'center',
    bodyCross: isFormat.value,
    barePages: pouring.value,
    clampEntries: isLiminaire.value,
    capPages: isChapitrage.value ? 2 : 0,
    wheelPaging: pouring.value,
    spreadPages: mainSpreadPages.value,
    nodeId: mainNodeId.value,
    depth: mainDepth.value,
    page: mainPage.value,
    margins: previewMargins.value,
    hyphenation: styleDefaults.hyphenation,
    runningTitles: pouring.value ? null : previewRunningTitles.value,
    bookTitle: pouring.value ? '' : bookTitle.value,
    highlightStyle: hoveredStyle.value,
    presentationMode: isChapitrage.value ? presentationMode.value : 'standard',
  },
  scene: {
    kind: searching.value ? 'analyse' : (focusedSourceKey.value === 'validation' ? 'validation' : null),
    isCloudView: isCloudView.value,
    analyseLeft: analyseLeft.value,
    analyseColumn: analyseColumn.value,
  },
}))

const { liveSlot, bundleFor, onSlotPaginated, shiftStyle, emitToken, fragScene } = useMaquetteSlide({
  focused, liveView, markSettled: onPaginated,
})

const onSlotStep = (slot, d) => { if (slot === liveSlot.value) stepResultPage(d) }
const onSlotSpread = (slot, g) => { if (slot === liveSlot.value) onSpreadGeometry(g) }
const onSlotBlock = (slot, g) => { if (slot === liveSlot.value) blockGeometry.value = g }
const onSlotStyle = (slot, g) => { if (slot === liveSlot.value) styleGeometry.value = g }

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
  fmtPage, styleDefaults, spreadGeometry,
  styleGeometry, blockGeometry, styles, limSpreadStyles, limFocusedSpread,
  limTypes, limSuggestions, liminaireConfig, limFocused, limSpreads,
  limSetType, setLimFocused, setHoveredStyle,
  rules, focusedSection, chapSpreadStyles, mainDepth, effectiveVisuals, previewRatio,
  showGroupes, hoveredNode, hoveredGroup, deviationGroups, mergeSuggestion,
  corpsSuggestion, merging, styleRows, onHoverGroup, applyMerge,
  inventory, highlights, zoned, focusedCran, onAsideWheel,
  annotationsLayout, annotationCharCounts, mutedColors, toggleMutedColor,
  searchLayout, resultPage, resultPageCount, stepResultPage,
  analyseLeft, analyseColumn, isCloudView, analyseCards, focusedLayer,
  geometryStale, presentationMode,
})
</script>

<style scoped>
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

.maquette__left {
  flex: 2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
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

.folio-slider {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

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

/* Mode visualisation : layout grille 2 colonnes -->
.folio-col--viz {
  overflow: auto;
  padding: var(--sp-3);
}

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
