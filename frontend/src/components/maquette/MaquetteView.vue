<template>
  <!-- Coquille : barres, sommaire, dock, UN FolioView persistant. L'état vit dans les
       composables (useMaquette*/useChapitrageModel) ; les overlays liés au jalon sont
       routés dans panes/ via provide('maq'). -->
  <div class="maquette">
    <MaquetteBar
        :zoom="zoom"
        :zooms="ZOOMS"
        :tally-row="activeTallyRow"
        :validating="validating"
        :recalibratable="recalibratable"
        :searching="searching"
        @validate="toggleValidation"
        @recalibrate="startRecalibration"
        @update:zoom="zoom = $event"
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
        :parts="parts"
        :active-series-key="focusedCran?.seriesKey ?? null"
        :trame="trame"
        :data="documentData"
        @focus-series="focusSeries"
        @select-node="selectNode"
    >
      <!-- Le dock accordéon est le pied du sommaire : ferré au bord gauche, hors du
           flux de la colonne d'aperçu (qui ne bouge donc jamais, quel que soit le pli). -->
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
        <!-- UN SEUL FolioView persistant pour les 3 sources : ses props changent mais
             l'iframe n'est jamais démontée → double-buffer, aucun clignotement. -->
        <section class="maquette__main">
          <div
              class="folio-stage"
              :class="{
                'folio-stage--lim': isLiminaire,
                'folio-stage--search': searchLayout,
              }"
          >
            <div class="folio-col">
              <FolioView
                  class="maq-folio"
                  mode="spread"
                  :visible-pages="folioVisiblePages"
                  :side-rails="1"
                  :column-shift="pouring ? -1 : 0"
                  :body-cross="isFormat"
                  :bare-pages="pouring"
                  :clamp-entries="isLiminaire"
                  :cap-pages="isChapitrage ? 2 : 0"
                  :wheel-paging="pouring"
                  :spread-pages="mainSpreadPages"
                  :node-id="mainNodeId"
                  :depth="mainDepth"
                  :data="documentData"
                  :visuals="effectiveVisuals"
                  :page="previewPage"
                  :margins="pouring ? SEARCH_MARGINS : previewMargins"
                  :hyphenation="styleDefaults.hyphenation"
                  :running-titles="pouring ? null : previewRunningTitles"
                  :book-title="pouring ? '' : bookTitle"
                  :highlight-style="hoveredStyle"
                  @step="stepResultPage"
                  @paginated="onPaginated"
                  @spread-geometry="onSpreadGeometry"
                  @block-geometry="blockGeometry = $event"
                  @style-geometry="styleGeometry = $event"
              />

              <!-- Chaque jalon monte son pane ICI, en couche par-dessus le FolioView
                   persistant, re-basé sur la géométrie émise (coords écran). -->
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
import FolioView from '../editor/FolioView.vue'
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
  useLiminaireBornes(trame, documentData, liminaireConfig, precedesOf)

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
  previewPage, previewMargins, previewRunningTitles, previewRatio, SEARCH_MARGINS,
  mainSpreadPages, mainNodeId, mainDepth,
  chapSpreadStyles, hoveredStyle, setHoveredStyle,
} = useMaquetteFolio({
  fmtPage, styleDefaults, searching, focusedSourceKey, isFormat, isLiminaire,
  limFocusedSpread, pouring, pageFragments, activeNeedle, pourTitle, resultOffset,
  statItems, modelNodeId, focusedSection, limFocused, focused,
})

// Réglage permanent : ×1 = planche d'ouverture (2 pages), ×3 = 6 pages de large. Seul
// réglage de `visible-pages` (le faire varier par cran figeait l'échelle en recherche).
const ZOOMS = [1, 2, 3, 4, 6]
const zoom = ref(1)
const folioVisiblePages = computed(() => 2 * zoom.value)

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

/* Le dock flotte au bord gauche (pied du sommaire), pas ici : l'aperçu ne lui réserve
   plus de bande, il prend toute la hauteur et se retire de la gouttière du sommaire. */
.maquette__left {
  flex: 2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-top: calc(2 * var(--bar-size) + 1em);
  padding-left: var(--maq-gutter);
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
