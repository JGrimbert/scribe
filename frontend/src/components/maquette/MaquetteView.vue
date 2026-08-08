<template>
  <!-- Écran Maquette. Colonne gauche (2/3) : l'aperçu témoin (UN FolioView
       persistant) surmontant le dock accordéon (pellicule de crans), tous deux
       sous la doc-bar. Colonne droite (1/3) : l'aside PLEINE HAUTEUR, qui défile
       SOUS la doc-bar et empile TOUS les modules de toutes les sections
       (Format · Liminaire · un bloc par niveau de chapitrage). Le cran focusé
       dans l'accordéon fait remonter sa section en tête (scroll-spy).
       Persistance via l'action « Enregistrer » de la doc-bar (`save`). -->
  <div class="maquette">
    <!-- Troisième barre de l'écran, empilée sous le menu et la doc-bar : la
         recherche à gauche, le dézoom à droite. Deux réglages permanents. -->
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

    <!-- Recalibration des bornes (relecture du .odt) : modale globale, déclenchée
         depuis MaquetteBar. Le flux (attente, calibration, commit) vit dans
         useRecalibration ; l'hôte enchaîne les rechargements au commit. -->
    <RecalibrationModal
        :open="recalOpen"
        :starting="recalStarting"
        :recal-error="recalErr"
        :preview="recalPreview"
        :shifted-start-index="shiftedStartIndex"
        @close="closeRecal"
        @committed="onRecalCommitted"
    />

    <!-- Rapport de recalibrage : carte flottante en tête de l'aperçu (pas de toast
         — une relecture perdue doit pouvoir se lire et se refaire). Fermable. -->
    <div v-if="recalReport" class="maq-recal-report">
      <UiCallout :tone="recalReport.droppedValidations.length ? 'error' : 'info'" title="Recalibré">
        {{ recalReport.restoredValidations }} validation(s) reposée(s)<template
            v-if="recalReport.droppedValidations.length"
        >, {{ recalReport.droppedValidations.length }} perdue(s) — à relire :
          <span class="maq-recal-report__dropped">
            {{ recalReport.droppedValidations.map((d) => `${d.slug} (${d.reason})`).join(', ') }}
          </span></template><template v-else>, aucune perdue.</template>
      </UiCallout>
      <button type="button" class="maq-recal-report__close" title="Fermer" @click="recalReport = null">
        <i class="pi pi-times" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Sommaire flottant (hors flux) : parties + arbre des axes. Toujours actif ;
         le cran focusé surligne sa partie, le nœud témoin son axe. -->
    <!-- Pas de `node-id` : l'arbre ne réagit pas à la partie focusée (ni surlignage
         de nœud ni dépliage). Seul l'item « Chapitrage n° » des parties se surligne
         (activeSeriesKey). Le témoin de l'aperçu (modelNodeId) est indépendant. -->
    <MaquetteStructureNav
        :parts="parts"
        :active-series-key="focusedCran?.seriesKey ?? null"
        :trame="trame"
        :data="documentData"
        @focus-series="focusSeries"
        @select-node="selectNode"
    >
      <!-- Le dock accordéon est le PIED du sommaire : ferré au bord gauche de la
           fenêtre, hors du flux de la colonne d'aperçu (qui ne bouge donc jamais,
           quel que soit le pli). L'accordéon rend lui-même ses onglets de zone. -->
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
            <!-- Les calques de tête : les sections d'analyse, dans la zone au nom
                 du livre. Le premier (Vocabulaire) est l'entrée du panneau de
                 recherche ; les suivants changent la vue montée à côté des
                 passages. -->
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

    <!-- Colonne gauche (2/3) : aperçu témoin + dock accordéon, sous la doc-bar. -->
    <div class="maquette__left">
      <div class="maquette__panels">
        <!-- Aperçu témoin : ni scroll ni overflow:hidden — le FolioView (spread)
             s'ajuste à la hauteur bornée de la bande. UN SEUL FolioView persistant
             pour les 3 sources : ses props changent, mais l'iframe n'est jamais
             démontée → double-buffer, AUCUN clignotement, gabarit/marges
             strictement identiques d'une source à l'autre. Les contrôles liminaire
             se superposent au survol. -->
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

              <!-- Les composants LIÉS AU JALON (overlays de format/liminaire/
                   chapitrage, scène de recherche, pager…) sont routés : chaque jalon a
                   son pane, monté ICI en couche par-dessus le FolioView persistant.
                   Le pane se re-base sur la géométrie émise (coords écran) → il s'aligne
                   sur le folio quel que soit son point de montage. -->
              <router-view />
            </div>
          </div>
        </section>
      </div>

    </div>

    <!-- Plus d'aside routée : le jalon Annotations pose son panneau de validation EN
         REGARD des lambeaux (dans le pane over-folio, comme la scène de recherche), et
         Format / Liminaire / Chapitrage se pilotent par les callouts posés SUR la
         planche. Le volet des familles de cas (validation du chapitrage) est monté par
         le pane Chapitrage (fixed → ancré au viewport). -->

    <!-- Édition d'un style : le panneau se pose SUR la page opposée à celle où le
         style est ancré (d'où la géométrie de planche + le rect du style). -->
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
import { ref, computed, inject, provide, onMounted, onUnmounted, watch, watchEffect, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MaquetteAccordeon from './MaquetteAccordeon.vue'
import MaquetteSpreadCell from './MaquetteSpreadCell.vue'
import MaquetteLiminaireCell from './MaquetteLiminaireCell.vue'
import MaquetteChapitreCell from './MaquetteChapitreCell.vue'
import MaquetteAnalyseCell from './MaquetteAnalyseCell.vue'
import MaquetteStructureNav from './MaquetteStructureNav.vue'
import MaquetteBar from './MaquetteBar.vue'
import FolioView from '../editor/FolioView.vue'
import PageDiagram from '../config/PageDiagram.vue'
import StyleEditorPanel from '../config/StyleEditorPanel.vue'
import RecalibrationModal from '../config/RecalibrationModal.vue'
import UiCallout from '../ui/atoms/UiCallout.vue'
import { effectivePage, effectiveMargins } from '../../script/pageFormats'
import { pathToInAxes } from '../../script/trame'
import { useTypologyConfig } from '../../composables/useTypologyConfig'
import { useRegistry } from '../../composables/useRegistry'
import { useRecalibration } from '../../composables/useRecalibration'
import { useLiminaireBornes } from '../../composables/useLiminaireBornes'
import { useLiminaireComposition } from '../../composables/useLiminaireComposition'
import { useAnalyse } from '../../composables/useAnalyse'
import { useDocSearch } from '../../composables/useDocSearch'
import { useDocStats } from '../../composables/useDocStats'
import { useAnnotations } from '../../composables/useAnnotations'
import { analyseLayers } from '../../script/analyseSections'
import { ANALYSE_CARDS } from '../analyse/analyseCards'
import { fragmentPages } from '../../script/searchFragment'
import { spreadStyles } from '../../script/liminaire-styles'
import { modelStyleNames } from '../../script/chapitrageModele'
import { levelConstraints, tallyByDepth } from '../../script/chapitrageValidation'
import { groupByDeviation } from '../../script/chapitrageGroupes'
import { mergeCandidates, corpsMergeCandidates, deviationStyleRows } from '../../script/chapitrageFusion'

const route = useRoute()
const router = useRouter()

// ── État de configuration (partagé avec l'écran config) ─────────────────────
// Même composable que la config : `load` peuple tout (styles, rules, sections,
// styleDefaults, liminaireConfig…), muté en place, `save` persiste d'un coup.
const trame = inject('documentTrame', null)
const documentData = inject('documentData', null)
const documentTitle = inject('documentTitle', null)

const {
  styles, rules, liminaireConfig, styleDefaults, sections,
  inventory, highlights, zoned, structureShapes,
  styleOverrides, styleBase, effectiveVisuals, saving, stylePrecedence,
  toggleRequireStyle, toggleAdjacency, addDeclaredStyle, removeDeclaredStyle,
  load, save,
} = useTypologyConfig()

// Ce qu'un style impose avant sa page ('none' par défaut) : la table des styles
// le règle, le regroupement liminaire et l'imposition le lisent.
const precedesOf = (styleName) => stylePrecedence[styleName] ?? 'none'

onMounted(() => { if (route.params.id) load(route.params.id) })

const bookTitle = computed(() => documentTitle?.value ?? '')

// Injections attendues par StyleRolesTable / StyleEditorPanel — copiées de
// ConfigView : la table est réutilisée telle quelle, à deux profondeurs.
const editingStyle = ref(null)
provide('openStyleEditor', (name) => { editingStyle.value = name })
provide('styleOverrides', styleOverrides)
provide('stylePrecedence', stylePrecedence)
provide('toggleRequireStyle', toggleRequireStyle)
provide('toggleAdjacency', toggleAdjacency)
provide('addDeclaredStyle', addDeclaredStyle)
provide('removeDeclaredStyle', removeDeclaredStyle)

// ── Source 2 : Liminaire ────────────────────────────────────────────────────
// borderShift = déplacement LOCAL de la borne de fin (aperçu, non persisté),
// consommé par la recalibration (borne proposée) ; pas d'UI pour le décaler
// aujourd'hui (l'ancien jalon étendre/exclure a été retiré) → reste à 0.
const {
  liminairePages,
  borderShift: limBorderShift,
} = useLiminaireBornes(trame, documentData, liminaireConfig, precedesOf)

// ── Recalibration des bornes (relecture du .odt) ────────────────────────────
// Reprise du flux de l'ancien écran de config (disparu) : la borne proposée à la
// calibration dépend du décalage prévisualisé du liminaire (limBorderShift).
const { documents, ensureLoaded, fetchDocuments } = useRegistry()
onMounted(ensureLoaded)

const docId = computed(() => route.params.id)
const {
  preview: recalPreview, report: recalReport, recalOpen, starting: recalStarting,
  recalError: recalErr, shiftedStartIndex,
  startRecalibration, closeRecal, finishCommit,
} = useRecalibration({ docId, borderShift: limBorderShift })

// hasSource absent (document importé avant DocumentSource) → recalibrage barré.
// Tant que le registre n'est pas chargé on ne barre pas (il clignoterait) ; le
// 404 backend reste le filet.
const currentDoc = computed(() => documents.value.find((d) => d.id === route.params.id) ?? null)
const recalibratable = computed(() => currentDoc.value?.hasSource !== false)

// Commit réussi : le rapport est retenu par le composable ; l'hôte enchaîne les
// rechargements (registre pour les stats, trame/data car les ids de nœuds sont
// regénérés, typologie car la ventilation change).
async function onRecalCommitted(summary) {
  finishCommit(summary)
  await fetchDocuments()
  reloadDocument?.()
  await load(route.params.id)
}

// ── Analyse : les sections du dashboard sont les crans de TÊTE de la pellicule
// (zone au nom du livre). La chaîne de révélation est l'entrée du DASHBOARD (une
// card après l'autre, sur signal) ; ici personne ne la lance, et sans elle chaque
// `AnalyseBlock` monté dans la scène resterait invisible, données présentes ou
// non. On révèle donc tout d'emblée — et DANS LE SETUP, pas au montage : la liste
// des sections en dépend (deux d'entre elles attendent `lexical`), et elle doit
// être arrêtée avant qu'on ne pose le cran focusé, sinon la pellicule gagne deux
// crans après coup et tout ce qui suit se décale sous le focus.
const { isRevealed, revealAll } = useAnalyse()
revealAll()
// Les sections d'analyse groupées en CALQUES : un calque = un cran de tête, qui
// empile ses cards au scroll (cf. analyseLayers, la scène de recherche).
const layers = computed(() => analyseLayers(isRevealed))

// `focused` (index dans la liste plate `crans`) reste la SOURCE DE VÉRITÉ INTERNE du
// dock/sommaire/analyse (il encode aussi quel calque d'analyse est actif DANS
// titredulivre — non exposé en URL). La route ne reflète que le JALON (+ planche
// liminaire / niveau chapitrage) ; la synchro bidirectionnelle (plus bas) le place.
// Défaut = 0 (premier cran = titredulivre) : l'écran s'ouvre sur le jalon de tête.
const focused = ref(0)

const {
  spreads: limSpreads, types: limTypes, suggestions: limSuggestions,
  onSetType: limSetType,
} = useLiminaireComposition({
  pages: () => liminairePages.value,
  config: () => liminaireConfig,
  title: () => bookTitle.value,
  focused: () => limFocused.value,
})

// ── Source 3 : Chapitrage ───────────────────────────────────────────────────
// Les sections de chapitrage (celles à `depthKey`), enrichies du jeu de règles
// effectif — la table et le « modèle exigé » les lisent.
const chapSections = computed(() =>
  sections.value
    .filter((s) => s.depthKey !== null)
    .map((s) => ({ ...s, ruleSet: rules.byDepth[s.depthKey] ?? null, defaultRuleSet: rules.default })),
)

// ── Séries : Format · Liminaire · Chapitrage n°1 · n°2… Chaque série est une
// suite de vis-à-vis, précédée dans l'accordéon de son onglet d'entrée (jalon
// informatif). Le liminaire porte autant de vis-à-vis que de planches, le
// chapitrage une par niveau.
const series = computed(() => {
  const out = []
  // En TÊTE, une zone au nom du livre : TOUTES les sections d'analyse, Vocabulaire
  // en premier (c'est l'entrée du panneau de recherche, donc la vue par défaut).
  // Elles ont eu leur propre pellicule ferrée à droite ; deux accordéons pour un
  // seul écran, c'était une pellicule de trop — l'analyse est une zone du livre
  // comme le Format ou le Liminaire. On y entre et on en sort en scrollant la
  // pellicule — la recherche est un cran comme un autre, pas un mode à part.
  // `wheelSkip` sur tous sauf le premier : la zone entière ne vaut qu'UN palier de
  // molette. On y entre sur le Vocabulaire, un cran de plus en ressort — les autres
  // sections ne s'atteignent qu'au clic sur leur calque (cf. MaquetteAccordeon).
  out.push({
    key: 'vocabulaire',
    label: bookTitle.value || 'Le livre',
    spreads: layers.value.map((l, i) => ({
      sourceKey: 'analyse', analyseKey: l.key, analyseLabel: l.label, wheelSkip: i > 0,
    })),
  })

  out.push({ key: 'format', label: 'Format', spreads: [{ sourceKey: 'maquette' }] })

  const sp = limSpreads.value
  out.push({
    key: 'liminaire',
    label: 'Liminaire',
    spreads: (sp.length ? sp : [null]).map((_, i) => ({ sourceKey: 'liminaire', spreadIndex: i })),
  })

  chapSections.value.forEach((sec, i) => {
    out.push({
      key: `chap-${i}`,
      label: `Chapitrage n°${i + 1}`,
      spreads: [{ sourceKey: 'chapitrage', sectionIndex: i, depthKey: sec.depthKey }],
    })
  })

  // Validation ferme la marche : elle ouvre la zone « Annotations », dernière de
  // la pellicule (ce qu'on dit du texte, après ce qui le compose).
  out.push({ key: 'validation', label: 'Validation', spreads: [{ sourceKey: 'validation' }] })
  return out
})

// Section d'accordéon d'une série : Format · Liminaire · Chapitrage (tous les
// niveaux de chapitrage fondus en UNE section, sans séparation visuelle interne)
// · Annotations.
function sectionOf(seriesKey) {
  if (seriesKey === 'vocabulaire') return { key: 'vocabulaire', label: bookTitle.value || 'Le livre' }
  if (seriesKey === 'format') return { key: 'format', label: 'Format' }
  if (seriesKey === 'liminaire') return { key: 'liminaire', label: 'Liminaire' }
  if (seriesKey === 'validation') return { key: 'annotations', label: 'Annotations' }
  return { key: 'chapitrage', label: 'Chapitrage' }
}

// Liste PLATE des vis-à-vis = l'unité de focus. Chaque cran porte de quoi retrouver
// son contenu, sa SÉRIE (pour le fil d'Ariane : « Chapitrage n°2 ») ET sa SECTION
// (pour l'accordéon : intervalle + onglet-jalon par section).
const crans = computed(() => {
  const out = []
  let prevSection = null
  series.value.forEach((s, si) => {
    const sec = sectionOf(s.key)
    s.spreads.forEach((sp) => {
      const isSectionStart = sec.key !== prevSection
      prevSection = sec.key
      out.push({
        ...sp, seriesIndex: si, seriesKey: s.key, seriesLabel: s.label,
        sectionKey: sec.key, sectionLabel: sec.label, isSectionStart,
      })
    })
  })
  return out
})

const focusedCran = computed(() => crans.value[focused.value] ?? null)
const focusedSourceKey = computed(() => focusedCran.value?.sourceKey ?? null)

// Niveau de pli par zone de l'accordéon ('open' | 'stack' | 'tab'). Piloté par la
// zone focusée (cf. applyAutoFolds) : une seule zone dépliée à la fois.
const folds = ref({})
const sectionKeys = computed(() => [...new Set(crans.value.map((c) => c.sectionKey))])

// La recherche n'est plus un mode de l'écran mais le CRAN de tête : elle est
// ouverte tant que le calque « Vocabulaire » est focusé. La rétraction automatique
// (applyAutoFolds) replie alors tout le reste en onglets, comme pour n'importe
// quelle autre zone.
const searching = computed(() => focusedSourceKey.value === 'analyse')

// Zone d'accordéon du cran focusé (à ne pas confondre avec `focusedSection`, la
// section de CHAPITRAGE focusée).
const focusedZoneKey = computed(() => focusedCran.value?.sectionKey ?? null)

// Rétraction automatique : quitter une zone la réduit à son ONGLET (2ᵉ cran,
// `tab`) — comme l'état de repos (hors survol), pas un simple empilement. Seule
// la zone du cran focusé reste dépliée : au survol, tout est en onglet sauf elle.
// L'animation est déjà portée par l'accordéon (transform sur la zone et ses
// feuillets).
function applyAutoFolds() {
  folds.value = Object.fromEntries(
    sectionKeys.value.map((k) => [k, k === focusedZoneKey.value ? 'open' : 'tab']),
  )
}

// On ne réapplique QU'au changement de zone (et à l'apparition d'une zone, quand
// les données arrivent après coup) : un pli posé à la main sur l'onglet reste
// souverain tant qu'on ne change pas de zone. Volontairement pas sur
// `sectionKeys` lui-même — ce computed se recrée à chaque recomposition des crans
// (extension du liminaire…) et écraserait ce pli manuel.
watch(
  [focusedZoneKey, () => sectionKeys.value.join('|')],
  applyAutoFolds,
  { immediate: true },
)

// Entrée/sortie du panneau de recherche : c'est un déplacement dans la pellicule,
// la molette suffit. Le champ (au focus) et Échap ne font que viser le cran. On
// entre par le Vocabulaire (premier cran d'analyse) et on sort par le premier cran
// qui n'en est pas — les sections d'analyse sont plusieurs, sortir n'est pas
// « avancer d'un cran ».
const vocabIndex = computed(() => crans.value.findIndex((c) => c.sourceKey === 'analyse'))
const afterAnalyseIndex = computed(() => {
  const i = crans.value.findIndex((c) => c.sourceKey !== 'analyse')
  return i === -1 ? crans.value.length - 1 : i
})
function enterSearch() {
  if (vocabIndex.value !== -1) focused.value = vocabIndex.value
}
function exitSearch() {
  if (searching.value) focused.value = afterAnalyseIndex.value
}

const searchQuery = ref('')
// Saisie DÉBOUNCÉE : chaque changement de `searchQuery` repagine l'iframe (Paged.js,
// plusieurs dizaines de ms), une frappe au caractère en lançait autant en parallèle.
const QUERY_DEBOUNCE = 220
let queryTimer = null
function onQuery(q) {
  clearTimeout(queryTimer)
  queryTimer = setTimeout(() => {
    searchQuery.value = q
    resultPage.value = 0
  }, QUERY_DEBOUNCE)
}
onUnmounted(() => clearTimeout(queryTimer))

// Passages à couler dans la page de résultats (phrase du chapitre trouvé qui porte
// la saisie) — mêmes hits que le volet de la doc-bar.
const { fragments: searchFragments, fragmentTotal: searchTotal } = useDocSearch(() => searchQuery.value)

// ── Jalon Annotations : les passages surlignés (typés « annotation ») coulés dans le
// MÊME folio que la recherche (lambeaux). Le menu de filtres éteint des couleurs
// (affichage seul, non persisté) → on les retire avant versage. `charCounts` alimente
// le décompte du seuil de rédaction, côté panneau (MaquetteAnnotations).
const { passages: annotationPassages, charCounts: annotationCharCounts } = useAnnotations(() => highlights)
const mutedColors = ref([])
function toggleMutedColor(color) {
  const i = mutedColors.value.indexOf(color)
  if (i === -1) mutedColors.value.push(color)
  else mutedColors.value.splice(i, 1)
}
const shownPassages = computed(() => annotationPassages.value.filter((p) => !mutedColors.value.includes(p.color)))

// Le folio « coule des lambeaux » pour DEUX sources : la recherche (jalon de tête) et
// les annotations (dernier jalon). Même page nue, source distincte — seul le RENDU
// folio est mutualisé, la logique de zone/accordéon reste propre à chaque jalon.
const pouring = computed(() => searching.value || focusedSourceKey.value === 'validation')
const activeFragments = computed(() => (searching.value ? searchFragments.value : shownPassages.value))
const activeTotal = computed(() => (searching.value ? searchTotal.value : shownPassages.value.length))
const activeNeedle = computed(() => (searching.value ? searchQuery.value : ''))

// Résultats paginés EN AMONT, une page de folio à la fois : un mot courant sort des
// milliers de passages, et les couler tous dans Paged.js (deux blocs par lambeau)
// fige l'écran pour n'en montrer que le premier écran. Le compte annoncé, lui, reste
// le VRAI total. Le cran est volontairement prudent — un lambeau de plus que ce que
// la page peut prendre et Paged.js ouvre une seconde page, hors cadre.
const RESULTS_PER_PAGE = 6
const resultPage = ref(0)
const resultPageCount = computed(() => Math.max(1, Math.ceil(activeTotal.value / RESULTS_PER_PAGE)))
const resultOffset = computed(() => resultPage.value * RESULTS_PER_PAGE)
const pageFragments = computed(() =>
  activeFragments.value.slice(resultOffset.value, resultOffset.value + RESULTS_PER_PAGE),
)

// Recale la tranche à 0 quand la SOURCE (recherche⇄annotations) ou le filtre change :
// sans ça on resterait sur une page vide après avoir éteint des couleurs.
watch([searching, () => mutedColors.value.length], () => { resultPage.value = 0 })

// Un cran de pagination (molette au-dessus du folio, ou pager). Borné aux deux bouts.
function stepResultPage(dir) {
  resultPage.value = Math.min(Math.max(resultPage.value + dir, 0), resultPageCount.value - 1)
}

// Le total peut fondre sans que la requête change (données du document arrivées
// après coup) : sans ce recalage, la tranche courante serait vide.
watch(resultPageCount, (n) => { if (resultPage.value > n - 1) resultPage.value = n - 1 })

// Texte de la carte de statut, en tête des lambeaux : le compte RÉEL (et non celui de
// la page), plus le rang de la page. Alimente `statusEntry` via fragmentPages. Le
// libellé suit la source (« Résultats » en recherche, « Annotations » au dernier jalon).
const pourTitle = computed(() => {
  const base = `${searching.value ? 'Résultats' : 'Annotations'} : ${activeTotal.value}`
  return resultPageCount.value > 1 ? `${base} · page ${resultPage.value + 1}/${resultPageCount.value}` : base
})

// NB : la cible du Teleport (`analyseAsideTo`) et `analyseFit` sont désormais fournis
// par le pane Vocabulaire (l'élément d'aside et ses cards consommatrices y vivent).

// La section dont la VUE est montée dans la scène (à droite des résultats), et la
// card correspondante. Le Vocabulaire fait exception : on y monte le nuage NU (la
// card entière lui adjoindrait occurrences + proximité, deux colonnes de trop ici).
const focusedLayer = computed(() => layers.value.find((l) => l.key === focusedCran.value?.analyseKey) ?? null)
const isCloudView = computed(() => focusedLayer.value?.key === 'vocabulaire')
// Un calque non-Vocabulaire empile les cards de ses sections (scroll vertical).
const analyseCards = computed(() =>
  (focusedLayer.value?.sections ?? [])
    .map((s) => ({ key: s.key, comp: ANALYSE_CARDS[s.key] }))
    .filter((c) => c.comp),
)

// NB : le gabarit du nuage (`CLOUD_DIMS`), la liste des types (`CLOUD_CATEGORIES`),
// le type porté par le grand nuage (`mainCategory`) et la mesure de la scène
// (`cloudEl`/ResizeObserver) vivent désormais dans le pane Vocabulaire.

// Chiffres du document : ils sont la rangée de TÊTE du lambeau de statut (ils
// vivaient dans le panneau du dock, disparu avec lui).
const { statItems } = useDocStats()

// Section de chapitrage focusée (null hors d'un cran chapitrage).
const focusedSection = computed(() => {
  const cran = focusedCran.value
  if (cran?.sourceKey !== 'chapitrage') return null
  return chapSections.value[cran.sectionIndex] ?? null
})

// Profondeur d'un nœud dans l'arbre → clé de niveau des règles (0/1/2+, plafonnée).
function depthKeyOf(nodeId) {
  const path = pathToInAxes(trame?.value?.axes ?? [], nodeId)
  return Math.min(Math.max(0, path.length - 1), 2)
}

// Tous les nœuds du livre à une clé de niveau donnée, dans l'ordre de lecture.
// depthKey 2 = « profondeur 2 et au-delà » (comme les règles) : on ne descend
// donc pas sous un nœud retenu, ses enfants relèvent du même niveau de règles.
function nodesAtDepthKey(depthKey) {
  const out = []
  const walk = (node, depth) => {
    if (Math.min(depth, 2) === depthKey) {
      out.push({ nodeId: node.id, titre: documentData?.value?.[node.id]?.titre ?? '(sans titre)' })
      return
    }
    for (const child of node.children ?? []) walk(child, depth + 1)
  }
  ;(trame?.value?.axes ?? []).forEach((axe) => walk(axe, 0))
  return out
}

// Premier nœud du livre à une clé de niveau donnée (le témoin de l'aperçu).
function firstNodeAtDepthKey(depthKey) {
  return nodesAtDepthKey(depthKey)[0]?.nodeId ?? null
}

// Nœud de RÉFÉRENCE du niveau : TOUJOURS son premier nœud (on n'illustre plus
// par un modèle relevé/exigé). C'est lui que rend l'aperçu témoin, et c'est de
// lui que l'aside relève le modèle.
const modelNodeId = computed(() => {
  if (focusedSourceKey.value !== 'chapitrage') return null
  const dk = focusedSection.value?.depthKey
  return dk == null ? null : firstNodeAtDepthKey(dk)
})

// Le MODÈLE d'un niveau = la suite des styles de son nœud de référence, titre
// compris. L'aside en tire ses deux tables : ce que le modèle porte, et ce que
// le niveau porte en plus.
const shapeByNode = computed(() => new Map(structureShapes.value.map((s) => [s.nodeId, s])))
const titleStyleOf = (nodeId) => documentData?.value?.[nodeId]?.styleName ?? null

function modelNamesAt(depthKey) {
  const nodeId = firstNodeAtDepthKey(depthKey)
  return nodeId ? modelStyleNames(shapeByNode.value.get(nodeId) ?? null, titleStyleOf(nodeId)) : []
}

const witnessItem = computed(() => (modelNodeId.value ? documentData?.value?.[modelNodeId.value] ?? null : null))
const modelNames = computed(() =>
  modelStyleNames(shapeByNode.value.get(modelNodeId.value) ?? null, titleStyleOf(modelNodeId.value)),
)

// ── Décompte validable / validé par niveau ──────────────────────────────────
// « Validable » = les contraintes de STYLES du niveau sont satisfaites ; par
// défaut ce sont celles du modèle, remplacées dès qu'une case « exigé » est
// cochée (cf. levelConstraints). « Validé » = la validation manuelle du
// chapitre, détenue par DocumentLayout.
const validations = inject('documentValidations', null)

const constraintsByDepth = computed(() =>
  Object.fromEntries(
    chapSections.value.map((sec) => [sec.depthKey, levelConstraints(sec.ruleSet ?? rules.default, modelNamesAt(sec.depthKey))]),
  ),
)

const chapTally = computed(() =>
  tallyByDepth(structureShapes.value, {
    constraintsByDepth: constraintsByDepth.value,
    titleStyleOf,
    validations: validations?.value ?? {},
  }),
)

// Une ligne par niveau pour l'aside : libellé de la série + son décompte.
const chapTallyRows = computed(() =>
  chapSections.value.map((sec, index) => ({
    index,
    label: `Chapitrage n°${index + 1}`,
    depthKey: sec.depthKey,
    fromModel: constraintsByDepth.value[sec.depthKey]?.fromModel ?? true,
    ...(chapTally.value[sec.depthKey] ?? { total: 0, validables: 0, valides: 0, perimes: 0 }),
  })),
)

// Le décompte du SEUL niveau focusé, pour la barre (l'aside n'affiche plus le
// tableau des niveaux). null hors chapitrage : le groupe quitte la barre.
const activeTallyRow = computed(() =>
  focusedCran.value?.sourceKey === 'chapitrage'
    ? (chapTallyRows.value[focusedCran.value.sectionIndex] ?? null)
    : null,
)

// ── Dézoom de la frame principale ───────────────────────────────────────────
// Réglage PERMANENT de l'écran (d'où sa place dans la barre, cf. MaquetteBar),
// pas un attribut d'un mode : ×1 = la planche d'ouverture (deux pages), ×3 =
// six pages de large. Il pilote `visible-pages` du
// FolioView, et la trame de fond pointillée suit l'échelle d'elle-même (cf.
// updateSpreadBg). Le SEUL réglage de `visible-pages` : la recherche n'en change
// plus (elle visait une page au lieu d'un vis-à-vis). C'est cette prop qui fixe
// l'échelle des pages (cf. useFolioScale : min sur la largeur ET la hauteur) — la
// faire varier d'un cran à l'autre remettait la planche à l'échelle en entrant
// dans la recherche (gouttières haut/bas qui changent) et déclenchait en plus le
// glissement animé d'`animateScale`, qui coupait la frame avant de la recaler.
const ZOOMS = [1, 2, 3, 4, 6]
const zoom = ref(1)
const folioVisiblePages = computed(() => 2 * zoom.value)

// ── Validation d'un niveau de chapitrage ────────────────────────────────────
// Mode à part entière (et non plus un dézoom de la scène) : la bascule ouvre le
// volet des familles de cas ferré en bas de fenêtre. Le dézoom reste un réglage
// 100 % indépendant — la validation n'y touche pas.
const validating = ref(false)

function toggleValidation() {
  validating.value = !validating.value
}

// Les nœuds du niveau focusé rangés par écart au modèle — le modèle restant celui
// du nœud de référence (le premier du niveau), comme partout ailleurs sur l'écran.
// Nœuds du niveau focusé, forme comprise — base commune des groupes et des deux
// suggestions de fusion (ne le recalculer pour chacun serait le même parcours 3×).
const levelNodes = computed(() => {
  const dk = focusedSection.value?.depthKey
  if (dk == null) return null
  return nodesAtDepthKey(dk).map((n) => ({ ...n, shape: shapeByNode.value.get(n.nodeId) ?? null }))
})

const deviationGroups = computed(() =>
  levelNodes.value ? groupByDeviation(levelNodes.value, modelNamesAt(focusedSection.value.depthKey), titleStyleOf) : [],
)

// Montrées quand la validation est ouverte : le volet des familles se ferre en
// bas de fenêtre en sur-impression (cf. .maq-groupes-zone) — sans toucher à la
// taille du folio, donc sans dézoomer les pages.
const showGroupes = computed(() => validating.value && !searching.value && !!deviationGroups.value.length)

// Survol d'une ligne : un aperçu LÉGER du premier nœud du groupe se pose sur la
// scène (MaquetteFragmentPreview, HTML nu — plus de repagination Paged.js). Un
// petit débounce suffit à lisser le balayage des lignes (le rendu est instantané).
const HOVER_DEBOUNCE = 40
const hoveredGroup = ref(null)
let hoverTimer = null
function onHoverGroup(group) {
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => { hoveredGroup.value = group }, HOVER_DEBOUNCE)
}

// Le nœud survolé, esquissé par l'aperçu léger (null hors survol → le témoin du
// modèle reste seul en scène).
const hoveredNode = computed(() => {
  const id = hoveredGroup.value?.nodes[0]?.nodeId
  return id ? documentData?.value?.[id] ?? null : null
})
// ── Fusion de deux styles ───────────────────────────────────────────────────
// Le même rôle sous deux noms condamne des centaines de chapitres pour rien. On
// ne propose que la paire la plus payante : trois lignes de suggestions, personne
// ne les lit.
const mergeSuggestion = computed(() => {
  const dk = focusedSection.value?.depthKey
  if (dk == null || !showGroupes.value) return null
  return mergeCandidates(levelNodes.value, modelNamesAt(dk), titleStyleOf).find((c) => c.gain > 0) ?? null
})

// Doublon de CORPS (« Paragraphes »/« Text body ») : invisible à mergeCandidates
// (mêmes rangs, coprésents) — c'est le rôle partagé qui le trahit. Suggestion
// SÉPARÉE : elle ne se dit pas en conformité mais en familles du graph repliées.
// Ne se déclenche que si les deux styles sont typés `corps` dans la typologie.
const roleOf = (name) => styles[name] ?? '?'
const corpsSuggestion = computed(() => {
  const dk = focusedSection.value?.depthKey
  if (dk == null || !showGroupes.value) return null
  return corpsMergeCandidates(levelNodes.value, roleOf, modelNamesAt(dk), titleStyleOf).find((c) => c.collapsed > 0) ?? null
})

// Panneau interactif des styles HORS MODÈLE (sous la planche, en regard des
// familles) : sorti de l'aside, chaque ligne dit sa part du problème et propose sa
// fusion (cf. script/chapitrageFusion, deviationStyleRows). Ne se calcule qu'en vue
// validation.
const styleRows = computed(() => {
  const dk = focusedSection.value?.depthKey
  if (dk == null || !showGroupes.value) return []
  return deviationStyleRows(levelNodes.value, roleOf, modelNamesAt(dk), titleStyleOf)
})

const merging = ref(false)
const reloadDocument = inject('reloadDocument', null)

// La fusion RÉÉCRIT le document (styles des paragraphes et des titres, en base)
// et ne se souvient de rien : une recalibration, qui reparse le `.odt`, ramènera
// les deux styles. D'où la confirmation, et la mention explicite.
async function applyMerge({ keep, drop, droppedCount }) {
  const ok = window.confirm(
    `Fondre « ${drop} » dans « ${keep} » ? ${droppedCount} chapitres seront réécrits.\n\n`
    + 'Le style « ' + drop + ' » disparaîtra du document. L\'opération n\'est pas annulable, '
    + 'et une recalibration depuis le .odt ramènera les deux styles.',
  )
  if (!ok) return
  merging.value = true
  try {
    const res = await fetch(`/api/documents/${route.params.id}/styles/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keep, drop }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // La map des rôles est FUSIONNÉE au chargement (pas remplacée, cf.
    // useTypologyConfig) : sans ce retrait, le style fondu y survivrait et la
    // prochaine sauvegarde le réintroduirait dans la typologie persistée.
    delete styles[drop]
    delete stylePrecedence[drop]
    await Promise.all([load(route.params.id), reloadDocument?.()])
  } catch (e) {
    window.alert(`Fusion impossible : ${e.message}`)
  } finally {
    merging.value = false
  }
}

// Le groupe survolé ne survit pas au repli de la liste ni au changement de niveau :
// sa clé n'y désigne plus rien.
watch([showGroupes, deviationGroups], () => {
  clearTimeout(hoverTimer)
  hoveredGroup.value = null
})
onUnmounted(() => clearTimeout(hoverTimer))

// ── Sommaire flottant : parties + navigation ────────────────────────────────
// La série `vocabulaire` (au nom du livre) reste dans la pellicule — c'est son
// calque de tête — mais PAS dans le sommaire : elle n'y ferait qu'un doublon du
// champ de recherche de MaquetteBar, qui vise déjà ce cran.
const parts = computed(() =>
  series.value.filter((s) => s.key !== 'vocabulaire').map((s) => ({ key: s.key, label: s.label })),
)

function focusSeries(seriesKey) {
  const i = crans.value.findIndex((c) => c.seriesKey === seriesKey)
  if (i !== -1) focused.value = i
}

// Navigation par molette dans l'aside : un coup = un saut vers le TITRE (série)
// suivant/précédent, pas un défilement libre. Le scroll-spy de l'aside anime le
// bloc en tête et tout le reste suit (dérive de `focused`). Verrou temporel : un
// « flick » de molette émet plusieurs events — on n'en retient qu'un le temps de
// l'animation, sinon on sauterait plusieurs sections d'un coup.
let wheelLock = false
function onAsideWheel(e) {
  if (wheelLock) return
  const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0
  if (!dir) return
  const keys = series.value.map((s) => s.key)
  const cur = keys.indexOf(focusedCran.value?.seriesKey)
  const next = Math.min(Math.max(cur + dir, 0), keys.length - 1)
  if (next === cur) return
  focusSeries(keys[next])
  wheelLock = true
  setTimeout(() => { wheelLock = false }, 450)
}

// Clic sur un axe : focus la série chapitrage de son niveau (l'arbre reste inerte,
// l'aperçu illustre toujours le premier nœud du niveau).
function selectNode(nodeId) {
  const i = chapSections.value.findIndex((s) => s.depthKey === depthKeyOf(nodeId))
  if (i !== -1) focusSeries(`chap-${i}`)
}


// Focus liminaire LOCAL (index de planche) dérivé du focus global, et l'inverse.
const limStart = computed(() => crans.value.findIndex((c) => c.sourceKey === 'liminaire'))
const limFocused = computed(() =>
  focusedSourceKey.value === 'liminaire' ? Math.max(0, focused.value - limStart.value) : 0,
)
function setLimFocused(localIndex) {
  const last = Math.max(0, limSpreads.value.length - 1)
  focused.value = limStart.value + Math.min(Math.max(localIndex, 0), last)
}

// La planche liminaire focusée (objet { left, right }) — alimente l'aperçu hybride.
const limFocusedSpread = computed(() => limSpreads.value[limFocused.value] ?? null)

// Styles du vis-à-vis focusé, pour SA table dans l'aside : le liminaire n'a pas de
// niveau (une seule zone pour toutes les planches), la table suit donc la planche
// et non la zone. Résolus contre l'inventaire de la zone pour garder ce que la
// table en sait (échantillon, styles déclarés à la main).
const liminaireInventory = computed(
  () => sections.value.find((s) => s.zone.key === 'liminaire')?.styles ?? [],
)
const limSpreadStyles = computed(() => spreadStyles(limFocusedSpread.value, liminaireInventory.value))

// Styles VISIBLES sur la planche chapitrage (ancrés au texte via `styleGeometry`),
// forme StyleRolesTable. Ordre des clés = ordre du DOM = ordre de lecture. La
// planche chapitrage est bornée à 2 pages (cap-pages) → seuls les styles de ce
// vis-à-vis. Pas de résolution d'inventaire ici : le nom suffit (crayon d'édition
// sur tout style non déclaré).
const chapSpreadStyles = computed(() => Object.keys(styleGeometry.value).map((name) => ({ name })))

// Style survolé dans une table de l'aside → surligné dans l'aperçu (teal + pointillé
// posé en dehors, cf. buildHighlightCss). Relâché au changement de cran : la table
// disparaît sans que la souris la quitte, son `mouseleave` ne partirait jamais.
const hoveredStyle = ref(null)
watch(focused, () => { hoveredStyle.value = null })
// Setter fourni aux panes (les callouts émettent `hover-style`) — plutôt que la ref
// nue, pour éviter l'ambiguïté d'assignation d'un ref destructuré côté pane.
const setHoveredStyle = (name) => { hoveredStyle.value = name }

// ── Source 1 : format de page ──────────────────────────────────────────────
// Relevé .odt brut (fourni par DocumentLayout), point de départ de l'aperçu.
const documentPageOdt = inject('documentPageOdt', null)
const fmtPage = computed(() => documentPageOdt?.value ?? null)

// Géométrie de la planche (rects écran des pages), émise par le FolioView
// persistant : alimente les ancres des callouts de format dockés sur l'aperçu.
const spreadGeometry = ref(null)

// La COMPOSITION de la scène en recherche (planche ferrée à gauche, vue d'analyse,
// aside, pager) suit `searching` avec UN CRAN DE RETARD : elle n'est posée qu'une
// fois le nouveau rendu paginé (le FolioView émet sa géométrie à chaque passe).
// Sinon la planche glissait à sa nouvelle place, et la vue d'analyse la coupait,
// pendant les ~150 ms où elle portait encore l'ancien contenu. Les PROPS du folio,
// elles, changent tout de suite : c'est ce qui déclenche la repagination.
// Elle attend en plus la FIN du glissement horizontal de la planche
// (`geometry.animating`, cf. useFolioScale) : le rAF d'`animateScale` émet une
// géométrie à chaque frame, poser la scène sur la première ferait apparaître le
// nuage à côté d'une planche encore en mouvement. La SORTIE, elle, est immédiate —
// laisser le nuage glisser par-dessus la planche qui revient n'aurait pas de sens.
// Fraîcheur du rendu du FolioView PERSISTANT. Il repagine en asynchrone (`refresh`)
// ET fait glisser la planche (`animateScale`, ~320 ms) : les deux sont indépendants
// et finissent dans un ordre quelconque. La scène de recherche et les fuyantes des
// callouts ne doivent se poser qu'une fois les DEUX terminés — sinon un scroll rapide
// les colle sur l'ancien contenu (nuage disloqué) ou sur d'anciennes ancres (flèches
// fugaces). D'où deux signaux, et non le seul `!animating` (qui retombe à la fin du
// glissé alors que la repagination du contenu peut être encore en vol) :
//  - `contentFresh` : le contenu du cran courant est paginé (FolioView `@paginated`) ;
//    remis à faux par toute navigation qui change ce que rend la planche (plus bas).
//  - `lastAnimating` : la dernière géométrie émise portait un glissement en cours.
const contentFresh = ref(false)
const lastAnimating = ref(false)
const geometryStale = computed(() => !contentFresh.value || lastAnimating.value)
const searchLayout = computed(() => searching.value && !geometryStale.value)
// Même garde de fraîcheur pour le jalon Annotations : son panneau « en regard » et son
// menu de filtres ne se posent qu'une fois la planche glissée et le contenu paginé.
const annotationsLayout = computed(() => focusedSourceKey.value === 'validation' && !geometryStale.value)

function onSpreadGeometry(geometry) {
  spreadGeometry.value = geometry
  lastAnimating.value = !!geometry?.animating
}
function onPaginated() {
  contentFresh.value = true
}

// Bord gauche de la vue d'analyse : le bord droit de la page de résultats, plus la
// gouttière. La planche gardant sa place et sa largeur de vis-à-vis, la vue occupe
// exactement la case de la page de droite (et tout ce qui suit jusqu'au bord).
// Repli sur 40 % tant que la géométrie n'est pas arrivée.
const analyseLeft = computed(() => {
  const p = spreadGeometry.value?.pages?.[0]
  return p ? `${Math.round(p.left + p.width)}px` : '40%'
})
// LA colonne : une période de trame (page + gouttière), telle que la planche la
// mesure. C'est celle que le glissement de la planche vers la gauche
// (`column-shift`) libère au bord droit — elle borne le nuage et donne sa largeur
// à la colonne des minis, les deux restant ainsi calés sur le pavage du fond.
// Repli sur une valeur en `em` tant que la géométrie n'est pas arrivée.
const analyseColumn = computed(() => {
  const period = spreadGeometry.value?.period
  return period ? `${Math.round(period)}px` : '22em'
})
// Rects écran des paragraphes rendus (clés par entry.key) : l'overlay liminaire y
// ancre ses contrôles de découpage en marge.
const blockGeometry = ref([])
// Rects écran de la 1re occurrence visible de chaque style (clés par nom) : les
// callouts de styles (liminaire/chapitrage) y ancrent leur fuyante.
const styleGeometry = ref({})

// Format/marges/titres EFFECTIFS = relevé .odt + surcharges EN COURS (styleDefaults,
// muté en place par MaquetteFormatCallouts). Nouvel objet à chaque
// édition (spread / clone profond) → les aperçus détectent le changement par référence.
const previewPage = computed(() => effectivePage(fmtPage.value, styleDefaults.pageSize))
const previewMargins = computed(() => ({ ...effectiveMargins(fmtPage.value, styleDefaults.pageMargins) }))
const previewRunningTitles = computed(() => JSON.parse(JSON.stringify(styleDefaults.runningTitles)))

// Recherche : marges nulles → les lambeaux occupent 100 % du folio (bord à bord).
// Couplé à `bare-pages` (ni papier ni empagement) et à des titres courants coupés,
// le folio n'est plus qu'un support pour le papier déchiré.
const SEARCH_MARGINS = { topCm: 0, bottomCm: 0, innerCm: 0, outerCm: 0 }

// Double-page vide de l'aperçu de format : deux pages sans contenu (l'empagement +
// la croix maquette sont dessinés par FolioView via `body-cross`). Constant.
const formatSpreadPages = [{ kind: 'empty' }, { kind: 'empty' }]

// ── Alimentation de l'UNIQUE FolioView selon la source focusée ───────────────
const isFormat = computed(() => focusedSourceKey.value === 'maquette')
const isLiminaire = computed(() => focusedSourceKey.value === 'liminaire')
const isChapitrage = computed(() => focusedSourceKey.value === 'chapitrage')

// Une cellule d'imposition → un slot de planche. Cellule nulle = face intérieure de
// couverture (garde). On garde TOUTES les entrées de contenu (blancs/ornements
// inclus : ce sont les espacements et ornements de la mise en page liminaire).
function limSlotFor(cell) {
  if (!cell) return { kind: 'cover', label: 'Page de garde' }
  if (cell.cover) return { kind: 'cover', label: 'Page de garde' }
  if (cell.blank) return { kind: 'blank', label: cell.implicit ? 'blanche · parité' : 'Page blanche' }
  return { kind: 'content', entries: cell.page?.entries ?? [] }
}
const limSpreadPages = computed(() => {
  const s = limFocusedSpread.value
  return s ? [limSlotFor(s.left), limSlotFor(s.right)] : []
})

// Props pilotées par la source : format/liminaire passent une planche (spreadPages),
// le chapitrage un nœud témoin (nodeId + depth). Mutuellement exclusifs.
const mainSpreadPages = computed(() => {
  // Versage en lambeaux (recherche OU annotations) : ils coulent dans le MÊME
  // FolioView, pages nues et PLEIN FOLIO (cf. SEARCH_MARGINS / titres courants
  // coupés) — mais UNE PAGE à la fois (cf. RESULTS_PER_PAGE). Le lambeau de statut
  // porte le compte total en tête ; les chiffres du document ne l'accompagnent qu'en
  // recherche (ils n'ont rien à dire de la liste des annotations).
  if (pouring.value) {
    return fragmentPages(pageFragments.value, activeNeedle.value, {
      status: pourTitle.value,
      stats: searching.value ? statItems.value : undefined,
      offset: resultOffset.value,
    })
  }
  if (isFormat.value) return formatSpreadPages
  if (isLiminaire.value) return limSpreadPages.value
  return null
})
// Le nœud rendu par la planche Paged.js : TOUJOURS le témoin du niveau. Le survol
// d'une famille ne le change plus (ça repaginait l'iframe, cf. le lag) — il pose
// un aperçu léger par-dessus (MaquetteFragmentPreview).
const mainNodeId = computed(() => modelNodeId.value)
const mainDepth = computed(() =>
  focusedSourceKey.value === 'chapitrage' ? (focusedSection.value?.depthKey ?? 0) : 0,
)

// Toute navigation qui change ce que rend la planche (source du cran, planche
// liminaire, nœud/niveau chapitrage) déclenche une repagination : le rendu courant
// devient périmé jusqu'au prochain `@paginated`. Volontairement PAS le zoom (il fait
// glisser sans changer le contenu → seul `lastAnimating` compte, `contentFresh` reste
// vrai) ni la pagination des résultats (le nuage n'en dépend pas), ni les réglages de
// format (leur édition garde ses callouts vivants pendant le glissé).
watch(
  () => [focusedSourceKey.value, limFocused.value, mainNodeId.value, mainDepth.value],
  () => { contentFresh.value = false },
)

// Ratio largeur/hauteur de la page effective : les cellules de l'accordéon
// l'adoptent pour partager le FORMAT des folios du main (A5 par défaut).
const previewRatio = computed(() => {
  const p = previewPage.value
  return p && p.widthCm && p.heightCm ? p.widthCm / p.heightCm : 148 / 210
})

// ── Persistance : l'action « Enregistrer » vit dans la doc-bar (slot d'action
// globale, contextuel par écran), comme la config y pose « Redéfinir les bornes ».
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

// Dernier maillon du fil d'Ariane : le JALON, tiré de la ROUTE (pas du cran).
// titredulivre (route par défaut) n'a PAS de maillon — il reste hors du fil d'Ariane.
const section = inject('documentSection', null)
watchEffect(() => {
  if (!section) return
  const n = route.name
  if (n === 'maquette-format') section.value = 'Format'
  else if (n === 'maquette-liminaire') section.value = `Liminaire n°${Math.max(1, parseInt(route.params.n) || 1)}`
  else if (n === 'maquette-chapitrage') section.value = `Chapitrage n°${Math.max(1, parseInt(route.params.n) || 1)}`
  else if (n === 'maquette-annotations') section.value = 'Annotations'
  else section.value = null // titredulivre : hors fil d'Ariane
})
onUnmounted(() => { if (section) section.value = null })

// ── Synchro `focused` ⇄ route ────────────────────────────────────────────────
// La route ne pin que le JALON (+ planche liminaire / niveau chapitrage) ; `focused`
// reste la SoT interne (dock/sommaire/calques d'analyse). Deux watches gardés par un
// flag anti-boucle. Le jalon de tête (vocabulaire) mappe sur la route par défaut
// (name `maquette`) : naviguer entre ses calques ne touche donc PAS l'URL.
let syncing = false

// Jalon (seriesKey) visé par la route courante (+ index local liminaire/chapitrage).
function routeTarget() {
  const n = route.name
  const idx = Math.max(0, (parseInt(route.params.n) || 1) - 1)
  if (n === 'maquette-format') return { key: 'format' }
  if (n === 'maquette-liminaire') return { key: 'liminaire', local: idx }
  if (n === 'maquette-chapitrage') return { key: `chap-${idx}` }
  if (n === 'maquette-annotations') return { key: 'validation' }
  return { key: 'vocabulaire' } // défaut (titredulivre)
}

// Location d'un cran (inverse), pour pousser l'URL depuis le dock/molette/sommaire.
function locationForCran(cran) {
  const id = route.params.id
  const k = cran?.seriesKey
  if (k === 'format') return { name: 'maquette-format', params: { id } }
  if (k === 'liminaire') return { name: 'maquette-liminaire', params: { id, n: String(Math.max(0, focused.value - limStart.value) + 1) } }
  if (k?.startsWith('chap-')) return { name: 'maquette-chapitrage', params: { id, n: String(Number(k.slice(5)) + 1) } }
  if (k === 'validation') return { name: 'maquette-annotations', params: { id } }
  return { name: 'maquette', params: { id } } // vocabulaire / défaut
}

// Deux locations désignent-elles le même jalon (nom + n) ?
function sameJalon(loc) {
  if (loc.name !== route.name) return false
  return String(loc.params?.n ?? '') === String(route.params.n ?? '')
}

// route → focused : pose le cran représentatif du jalon (sauf si on y est déjà —
// préserve le calque d'analyse courant dans titredulivre). Tolère `crans` vide (fetch
// async) : re-tourne dès que la liste se peuple (dépendance sur sa longueur).
watch(
  () => [route.name, route.params.n, crans.value.length],
  () => {
    if (syncing) return
    const t = routeTarget()
    const cur = focusedCran.value
    if (cur?.seriesKey === t.key) {
      if (t.key !== 'liminaire') return
      if (focused.value - limStart.value === t.local) return
    }
    let idx = -1
    if (t.key === 'vocabulaire') idx = vocabIndex.value
    else if (t.key === 'liminaire') {
      const base = limStart.value
      idx = base < 0 ? -1 : base + Math.min(t.local, Math.max(0, limSpreads.value.length - 1))
    } else idx = crans.value.findIndex((c) => c.seriesKey === t.key)
    if (idx >= 0) {
      syncing = true
      focused.value = idx
      nextTick(() => { syncing = false })
    }
  },
  { immediate: true },
)

// focused → route : reflète le jalon dans l'URL (replace : la molette ne pollue pas
// l'historique). No-op tant qu'on reste dans le même jalon (dont l'intra-vocabulaire).
watch(focused, () => {
  if (syncing) return
  const loc = locationForCran(focusedCran.value)
  if (sameJalon(loc)) return
  syncing = true
  Promise.resolve(router.replace(loc)).catch(() => {}).finally(() => { syncing = false })
})

// ── Modèle partagé fourni aux panes routés (le FolioView reste dans la coquille) ──
provide('maq', {
  // Format
  fmtPage, styleDefaults, spreadGeometry,
  // Liminaire
  styleGeometry, blockGeometry, styles, limSpreadStyles, limFocusedSpread,
  limTypes, limSuggestions, liminaireConfig, limFocused, limSpreads,
  limSetType, setLimFocused, setHoveredStyle,
  // Chapitrage
  rules, focusedSection, chapSpreadStyles, mainDepth, effectiveVisuals, previewRatio,
  showGroupes, hoveredNode, hoveredGroup, deviationGroups, mergeSuggestion,
  corpsSuggestion, merging, styleRows, onHoverGroup, applyMerge,
  // Annotations (jalon validation) : lambeaux + menu de filtres + panneau « en regard »
  inventory, highlights, zoned, focusedCran, onAsideWheel,
  annotationsLayout, annotationCharCounts, mutedColors, toggleMutedColor,
  // Vocabulaire (titredulivre)
  searchLayout, resultPage, resultPageCount, stepResultPage,
  analyseLeft, analyseColumn, isCloudView, analyseCards, focusedLayer,
  // Fraîcheur de la géométrie émise : les panes en gardent leurs fuyantes tant
  // qu'elle est périmée (scroll rapide), cf. geometryStale.
  geometryStale,
})
</script>

<style scoped>
/* Rangée : colonne gauche (2/3, aperçu + dock, sous la doc-bar) · aside (1/3,
   pleine hauteur, défile SOUS la barre). La page ne scrolle pas globalement —
   chaque colonne porte sa propre CustomScrollbar. */
.maquette {
  /* Gouttière du sommaire + hauteur du dock + hauteur du volet de validation :
     hissées ici pour être vues À LA FOIS par la colonne gauche et par le volet
     groupes ferré au viewport (cf. .maq-groupes-zone). */
  --maq-gutter: 15em;
  --maq-dock-h: 11.8em;
  /* Hauteur du volet de validation : en `vh` pour remonter dans la fenêtre et
     recouvrir le bas de la planche du folio (au-delà du dock). */
  --maq-groupes-h: 48vh;
  position: relative;
  display: flex;
  align-items: stretch;
  gap: var(--sp-4);
  height: 100%;
  overflow: hidden;
}

/* Colonne gauche : l'aperçu témoin seul, sous la doc-bar (padding-top réserve sa
   hauteur, aligné sur ConfigView). Le dock accordéon n'est PAS ici — il est le
   pied du sommaire flottant (`MaquetteStructureNav`) et FLOTTE par-dessus, au bord
   gauche. L'aperçu ne lui réserve donc plus de bande : il prend toute la hauteur
   et se retire seulement de la gouttière du sommaire (`--maq-gutter`). Plier ou
   déplier ne change toujours rien à sa hauteur — le FolioView ne se remet pas à
   l'échelle à chaque pli. */
.maquette__left {
  flex: 2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* Sous les DEUX barres : la doc-bar et la barre de la maquette (MaquetteBar). */
  padding-top: calc(2 * var(--bar-size) + 1em);
  /* Gouttière du sommaire (flottant, hors flux) : sans elle l'aperçu se centre
     sur la FENÊTRE et passe donc sous la liste. La zone utile commence à son
     bord droit — c'est là que la planche et ses rails se centrent. */
  padding-left: var(--maq-gutter);
  /* Le dock ne s'AJOUTE plus à la hauteur réservée : il flotte au bord gauche et
     sa bande est vide partout ailleurs (elle ne prend d'ailleurs plus le pointeur,
     cf. MaquetteAccordeon). L'aperçu descend donc jusqu'en bas et grossit tant que
     la LARGEUR le permet — sinon la planche restait petite avec du blanc dessous.
     Ne reste réservé que ce qui se pose SOUS la planche : selects de type
     (liminaire) et bloc des dimensions (format). */
  padding-bottom: 5em;
}

/* Bande de l'aperçu : prend la hauteur restante, colonne flex sans overflow —
   le FolioView (spread) s'ajuste tout seul, pas de scroll ni de scrollbar. */
.maquette__panels {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* La section de source remplit EXACTEMENT la bande (hauteur bornée pour le
   FolioView double-page), sans jamais déborder. */
.maquette__main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  flex: 1 1 auto;
  min-height: 0;
  padding-top: 1em;
}

/* Folio de format : remplit le main comme le FolioView du chapitrage (flex:1),
   pour un gabarit iso d'une source à l'autre. */
.maq-folio {
  flex: 1 1 auto;
  min-height: 0;
}

/* Le volet des familles de cas (`.maq-groupes-zone`) et l'aside de validation
   (`.maquette__aside-col`) ont migré dans leurs panes (Chapitrage / Annotations). */

/* Scène du FolioView unique : remplit le main, sert de repère au overlay absolu
   des contrôles liminaire (montés par le pane routé). Même hauteur bornée pour
   toutes les sources → échelle iso. */
.folio-stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

/* Colonne du folio : le FolioView + son pager. Elle prend toute la scène — la vue
   d'analyse de la recherche est posée par-dessus, ferrée à la page de résultats. */
.folio-col {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

/* La scène de recherche (nuage, cards, minis, pager) et l'overlay des contrôles
   liminaire ont migré dans leurs panes (Vocabulaire / Liminaire), avec leur CSS. */

/* Rapport de recalibrage : carte flottante centrée en tête de l'écran, sous les
   deux barres. Au-dessus de l'aperçu et du sommaire, sous les modales (z 200). */
.maq-recal-report {
  position: fixed;
  top: calc(2 * var(--bar-size) + 0.75em);
  left: calc(var(--maq-gutter) + (100% - var(--maq-gutter)) / 2);
  transform: translateX(-50%);
  z-index: 175;
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  width: min(46em, 60%);
}

.maq-recal-report__dropped {
  font-family: var(--font-ui);
  font-weight: 600;
}

.maq-recal-report__close {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.7em;
  height: 1.7em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  color: var(--c-ink2);
  cursor: pointer;
}

.maq-recal-report__close:hover {
  color: var(--c-danger);
}

/* Aperçu de page dans la cellule d'accordéon : ajusté sur la HAUTEUR du cran (le
   SVG double-page suit son ratio), pour partager le format des autres cellules. */
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
