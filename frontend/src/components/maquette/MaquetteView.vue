<template>
  <!-- Écran Maquette. Colonne gauche (2/3) : l'aperçu témoin (UN FolioView
       persistant) surmontant le dock accordéon (pellicule de crans), tous deux
       sous la doc-bar. Colonne droite (1/3) : l'aside PLEINE HAUTEUR, qui défile
       SOUS la doc-bar et empile TOUS les modules de toutes les sections
       (Format · Liminaire · un bloc par niveau de chapitrage). Le cran focusé
       dans l'accordéon fait remonter sa section en tête (scroll-spy).
       Persistance via l'action « Enregistrer » de la doc-bar (`save`). -->
  <div class="maquette">
    <!-- Sommaire flottant (hors flux) : parties + arbre des axes. Toujours actif ;
         le cran focusé surligne sa partie, le nœud témoin son axe. -->
    <!-- Pas de `node-id` : l'arbre ne réagit pas à la partie focusée (ni surlignage
         de nœud ni dépliage). Seul l'item « Chapitrage n° » des parties se surligne
         (activeSeriesKey). Le témoin de l'aperçu (currentNodeId) est indépendant. -->
    <MaquetteStructureNav
        :parts="parts"
        :active-series-key="focusedCran?.seriesKey ?? null"
        :trame="trame"
        :data="documentData"
        @focus-series="focusSeries"
        @select-node="selectNode"
        @update:searching="onSearching"
        @update:query="onQuery"
    >
      <!-- Le dock accordéon est le PIED du sommaire : ferré au bord gauche de la
           fenêtre, hors du flux de la colonne d'aperçu (qui ne bouge donc jamais,
           quel que soit le pli). L'accordéon rend lui-même ses onglets de zone. -->
      <template #footer>
        <MaquetteAccordeon
            v-model:folds="folds"
            :crans="crans"
            :focused="focused"
            :ratio="previewRatio"
            @update:focused="focused = $event"
        >
          <template #spread="{ cran }">
            <PageDiagram
                v-if="cran.sourceKey === 'maquette'"
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

          <!-- Recherche ouverte : l'accordéon se replie en onglets et rend sa place
               à la maquette. Le nuage, qui l'occupait, est passé dans la scène (en
               regard des résultats, cf. .maq-cloud). -->
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
          <div class="folio-stage" :class="{ 'folio-stage--lim': isLiminaire, 'folio-stage--search': searching }">
            <!-- Colonne du folio : wrapper PERMANENT (jamais de v-if dessus, le
                 FolioView ne doit pas être démonté) qui porte le pager de résultats. -->
            <div class="folio-col">
              <FolioView
                  class="maq-folio"
                  mode="spread"
                  :visible-pages="searching ? 1 : 2"
                  :body-cross="isFormat && !searching"
                  :bare-pages="searching"
                  :wheel-paging="searching"
                  :spread-pages="mainSpreadPages"
                  :node-id="mainNodeId"
                  :depth="mainDepth"
                  :data="documentData"
                  :visuals="effectiveVisuals"
                  :page="previewPage"
                  :margins="searching ? SEARCH_MARGINS : previewMargins"
                  :hyphenation="styleDefaults.hyphenation"
                  :running-titles="searching ? null : previewRunningTitles"
                  :book-title="searching ? '' : bookTitle"
                  @step="stepResultPage"
              />
              <!-- Pager : la molette au-dessus du folio fait la même chose, mais elle
                   ne s'annonce pas. -->
              <div v-if="searching && resultPageCount > 1" class="maq-pager">
                <button
                    type="button" class="maq-pager__btn" aria-label="Résultats précédents"
                    :disabled="resultPage === 0" @click="stepResultPage(-1)"
                >
                  <i class="pi pi-chevron-left"></i>
                </button>
                <span class="maq-pager__count">{{ resultPage + 1 }} / {{ resultPageCount }}</span>
                <button
                    type="button" class="maq-pager__btn" aria-label="Résultats suivants"
                    :disabled="resultPage >= resultPageCount - 1" @click="stepResultPage(1)"
                >
                  <i class="pi pi-chevron-right"></i>
                </button>
              </div>
            </div>

            <!-- Nuage de lemmes, en regard des résultats sur DEUX pages de largeur
                 (la page de résultats en fait une). Il vivait dans le dock ; ici il
                 partage la scène, à l'échelle du reste de la maquette. -->
            <div v-if="searching" ref="cloudEl" class="maq-cloud">
              <VocabulaireCloud compact :width="cloudW" :dims="CLOUD_DIMS" />
            </div>
            <div v-if="isLiminaire" class="lim-hover__controls">
              <AccordeonControls
                  :spreads="limSpreads"
                  :focused="limFocused"
                  :types="limTypes"
                  :suggestions="limSuggestions"
                  :sides="limSides"
                  :expected-sides="limExpectedSides"
                  :conflicts="limConflicts"
                  @update:focused="setLimFocused"
                  @set-type="limSetType"
                  @set-side="limSetSide"
              />
              <LiminaireDecoupage :pages="limFocusedPages" :config="liminaireConfig" :empty-label="limEmptyLabel" />
            </div>
          </div>
        </section>
      </div>

    </div>

    <!-- Aside (1/3) PLEINE HAUTEUR : sans cadre propre, elle défile SOUS la
         doc-bar (top-offset de la track). Extraite dans MaquetteAside ; le cran
         focusé fait remonter sa section (scroll-spy interne via `active-block`).
         Recherche ouverte : elle s'efface — la planche de résultats prend toute la
         largeur, et la section du cran focusé n'a plus rien à commenter. `v-show`
         et non `v-if` : rien à remonter (tables de styles, scrollbar) au retour. -->
    <div v-show="!searching" class="maquette__aside-col" @wheel.prevent="onAsideWheel">
      <CustomScrollbar :top-offset="42">
        <MaquetteAside
            :fmt-page="fmtPage"
            :style-defaults="styleDefaults"
            :elig="limElig"
            :lim-can-extend="limCanExtend"
            :lim-next-title="limNextTitle"
            :lim-border-shift="limBorderShift"
            :chap-sections="chapSections"
            :style-roles="styles"
            :rules="rules"
            :active-block="focusedCran?.seriesKey ?? null"
            @extend="extendLiminaire"
            @exclude="excludeLiminaire"
        />
      </CustomScrollbar>
    </div>

    <StyleEditorPanel
        :style-name="editingStyle"
        :base="editingStyle ? styleBase[editingStyle] : null"
        :overrides="styleOverrides"
        @close="editingStyle = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, inject, provide, onMounted, onUnmounted, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import MaquetteAccordeon from './MaquetteAccordeon.vue'
import MaquetteSpreadCell from './MaquetteSpreadCell.vue'
import MaquetteLiminaireCell from './MaquetteLiminaireCell.vue'
import MaquetteChapitreCell from './MaquetteChapitreCell.vue'
import MaquetteAside from './MaquetteAside.vue'
import MaquetteStructureNav from './MaquetteStructureNav.vue'
import VocabulaireCloud from '../analyse/lexical/VocabulaireCloud.vue'
import FolioView from '../editor/FolioView.vue'
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'
import PageDiagram from '../config/PageDiagram.vue'
import StyleEditorPanel from '../config/StyleEditorPanel.vue'
import AccordeonControls from '../liminaire/AccordeonControls.vue'
import LiminaireDecoupage from '../liminaire/LiminaireDecoupage.vue'
import { effectivePage, effectiveMargins } from '../../script/pageFormats'
import { pathToInAxes } from '../../script/trame'
import { useTypologyConfig } from '../../composables/useTypologyConfig'
import { useLiminaireBornes } from '../../composables/useLiminaireBornes'
import { useLiminaireComposition } from '../../composables/useLiminaireComposition'
import { useDocSearch } from '../../composables/useDocSearch'
import { useDocStats } from '../../composables/useDocStats'
import { fragmentPages } from '../../script/searchFragment'

const route = useRoute()

// ── État de configuration (partagé avec l'écran config) ─────────────────────
// Même composable que la config : `load` peuple tout (styles, rules, sections,
// styleDefaults, liminaireConfig…), muté en place, `save` persiste d'un coup.
const trame = inject('documentTrame', null)
const documentData = inject('documentData', null)
const documentTitle = inject('documentTitle', null)

const {
  styles, rules, liminaireConfig, styleDefaults, sections,
  styleOverrides, styleBase, effectiveVisuals, saving,
  toggleRequireStyle, toggleAdjacency, addDeclaredStyle, removeDeclaredStyle,
  load, save,
} = useTypologyConfig()

onMounted(() => { if (route.params.id) load(route.params.id) })

const bookTitle = computed(() => documentTitle?.value ?? '')

// Injections attendues par StyleRolesTable / StyleEditorPanel — copiées de
// ConfigView : la table est réutilisée telle quelle, à deux profondeurs.
const editingStyle = ref(null)
provide('openStyleEditor', (name) => { editingStyle.value = name })
provide('styleOverrides', styleOverrides)
provide('toggleRequireStyle', toggleRequireStyle)
provide('toggleAdjacency', toggleAdjacency)
provide('addDeclaredStyle', addDeclaredStyle)
provide('removeDeclaredStyle', removeDeclaredStyle)

// ── Source 2 : Liminaire ────────────────────────────────────────────────────
// borderShift = déplacement LOCAL de la borne de fin (aperçu, non persisté). Étendre
// absorbe le chapitre suivant dans le liminaire, exclure relâche le dernier.
const {
  liminairePages,
  borderShift: limBorderShift,
  canExtend: limCanExtend,
  nextTitle: limNextTitle,
} = useLiminaireBornes(trame, documentData, liminaireConfig)

const focused = ref(0)

const {
  spreads: limSpreads, types: limTypes, suggestions: limSuggestions,
  sides: limSides, expectedSides: limExpectedSides, conflicts: limConflicts,
  elig: limElig, focusedPages: limFocusedPages, emptyLabel: limEmptyLabel,
  onSetType: limSetType, onSetSide: limSetSide,
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
  return out
})

// Section d'accordéon d'une série : Format · Liminaire · Chapitrage (tous les
// niveaux de chapitrage fondus en UNE section, sans séparation visuelle interne).
function sectionOf(seriesKey) {
  if (seriesKey === 'format') return { key: 'format', label: 'Format' }
  if (seriesKey === 'liminaire') return { key: 'liminaire', label: 'Liminaire' }
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

// Niveau de pli par zone de l'accordéon ('open' | 'stack' | 'tab'). Tout est
// déplié au départ.
const folds = ref({})
const sectionKeys = computed(() => [...new Set(crans.value.map((c) => c.sectionKey))])

// Recherche ouverte → l'accordéon se réduit à ses onglets (il rend sa place au
// panneau). C'est un EFFET de la recherche, pas une préférence : on mémorise
// l'état d'avant pour le rendre à la fermeture.
const searching = ref(false)
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

// Résultats paginés EN AMONT, une page de folio à la fois : un mot courant sort des
// milliers de passages, et les couler tous dans Paged.js (deux blocs par lambeau)
// fige l'écran pour n'en montrer que le premier écran. Le compte annoncé, lui, reste
// le VRAI total. Le cran est volontairement prudent — un lambeau de plus que ce que
// la page peut prendre et Paged.js ouvre une seconde page, hors cadre.
const RESULTS_PER_PAGE = 6
const resultPage = ref(0)
const resultPageCount = computed(() => Math.max(1, Math.ceil(searchTotal.value / RESULTS_PER_PAGE)))
const resultOffset = computed(() => resultPage.value * RESULTS_PER_PAGE)
const pageFragments = computed(() =>
  searchFragments.value.slice(resultOffset.value, resultOffset.value + RESULTS_PER_PAGE),
)

// Un cran de pagination (molette au-dessus du folio, ou pager). Borné aux deux bouts.
function stepResultPage(dir) {
  resultPage.value = Math.min(Math.max(resultPage.value + dir, 0), resultPageCount.value - 1)
}

// Le total peut fondre sans que la requête change (données du document arrivées
// après coup) : sans ce recalage, la tranche courante serait vide.
watch(resultPageCount, (n) => { if (resultPage.value > n - 1) resultPage.value = n - 1 })

// Texte de la carte de statut, en tête des résultats : le compte RÉEL (et non celui
// de la page), plus le rang de la page. Alimente `statusEntry` via fragmentPages.
const searchTitle = computed(() => {
  const base = `Résultats : ${searchTotal.value}`
  return resultPageCount.value > 1 ? `${base} · page ${resultPage.value + 1}/${resultPageCount.value}` : base
})

// Gabarit du nuage inline : deux pages de large pour une de haut (≈ le ratio d'une
// double page A5), là où le dock lui donnait un bandeau plat.
const CLOUD_DIMS = { width: 1040, height: 740, verticalRatio: 0.25 }
const cloudEl = ref(null)
const cloudW = ref(0)
let cloudRo = null
watch(cloudEl, (el) => {
  cloudRo?.disconnect()
  if (!el) { cloudRo = null; return }
  const measure = () => { cloudW.value = el.clientWidth }
  measure()
  cloudRo = new ResizeObserver(measure)
  cloudRo.observe(el)
})
onUnmounted(() => cloudRo?.disconnect())

// Chiffres du document : ils sont la rangée de TÊTE du lambeau de statut (ils
// vivaient dans le panneau du dock, disparu avec lui).
const { statItems } = useDocStats()

let foldBeforeSearch = null
function onSearching(active) {
  searching.value = active
  if (active) {
    if (foldBeforeSearch === null) foldBeforeSearch = folds.value
    folds.value = Object.fromEntries(sectionKeys.value.map((k) => [k, 'tab']))
  } else if (foldBeforeSearch !== null) {
    folds.value = foldBeforeSearch
    foldBeforeSearch = null
  }
}

// Section de chapitrage focusée (null hors d'un cran chapitrage).
const focusedSection = computed(() => {
  const cran = focusedCran.value
  if (cran?.sourceKey !== 'chapitrage') return null
  return chapSections.value[cran.sectionIndex] ?? null
})

// Le scroll-spy de l'aside (remontée de la section focusée) vit dans MaquetteAside,
// piloté par la prop `active-block` (= série du cran focusé).

// Profondeur d'un nœud dans l'arbre → clé de niveau des règles (0/1/2+, plafonnée).
function depthKeyOf(nodeId) {
  const path = pathToInAxes(trame?.value?.axes ?? [], nodeId)
  return Math.min(Math.max(0, path.length - 1), 2)
}

// Premier nœud du livre à une clé de niveau donnée. depthKey 2 = première
// profondeur ≥ 2.
function firstNodeAtDepthKey(depthKey) {
  let found = null
  const walk = (node, depth) => {
    if (found) return
    if (Math.min(depth, 2) === depthKey) { found = node.id; return }
    for (const child of node.children ?? []) walk(child, depth + 1)
  }
  ;(trame?.value?.axes ?? []).forEach((axe) => walk(axe, 0))
  return found
}

// Nœud témoin de l'aperçu chapitrage : TOUJOURS le premier nœud disponible du
// niveau (on n'illustre plus par un modèle relevé/exigé).
const currentNodeId = computed(() => {
  if (focusedSourceKey.value !== 'chapitrage') return null
  const dk = focusedSection.value?.depthKey
  return dk == null ? null : firstNodeAtDepthKey(dk)
})

// ── Sommaire flottant : parties + navigation ────────────────────────────────
const parts = computed(() => series.value.map((s) => ({ key: s.key, label: s.label })))

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

// Fin du liminaire (migrée du jalon vers l'aside — le jalon n'est plus qu'un
// marqueur informatif) : étendre absorbe le chapitre suivant, exclure relâche le
// dernier. Aperçu seul (recomposition des crans dans le même tick, non persisté).
function extendLiminaire() { limBorderShift.value++ }
function excludeLiminaire() { if (limBorderShift.value > 0) limBorderShift.value-- }

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

// ── Source 1 : format de page ──────────────────────────────────────────────
// Relevé .odt brut (fourni par DocumentLayout), point de départ de l'aperçu.
const documentPageOdt = inject('documentPageOdt', null)
const fmtPage = computed(() => documentPageOdt?.value ?? null)

// Format/marges/titres EFFECTIFS = relevé .odt + surcharges EN COURS (styleDefaults,
// muté en place par MaquetteFormatControls/RunningBandControl). Nouvel objet à chaque
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
  // Recherche : les lambeaux coulent dans le MÊME FolioView, pages nues et PLEIN
  // FOLIO (cf. SEARCH_MARGINS / titres courants coupés) — mais UNE PAGE à la fois
  // (cf. RESULTS_PER_PAGE). Le lambeau de statut porte le compte total en tête.
  if (searching.value) {
    return fragmentPages(pageFragments.value, searchQuery.value, {
      status: searchTitle.value,
      stats: statItems.value,
      offset: resultOffset.value,
    })
  }
  if (isFormat.value) return formatSpreadPages
  if (isLiminaire.value) return limSpreadPages.value
  return null
})
const mainNodeId = computed(() => currentNodeId.value)
const mainDepth = computed(() => (focusedSourceKey.value === 'chapitrage' ? (focusedSection.value?.depthKey ?? 0) : 0))

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

// Dernier maillon du fil d'Ariane : la série du cran focusé (« Format » /
// « Liminaire » / « Chapitrage n°1 »), déjà portée par le cran.
const section = inject('documentSection', null)
watchEffect(() => { if (section) section.value = focusedCran.value?.seriesLabel ?? null })
onUnmounted(() => { if (section) section.value = null })
</script>

<style scoped>
/* Rangée : colonne gauche (2/3, aperçu + dock, sous la doc-bar) · aside (1/3,
   pleine hauteur, défile SOUS la barre). La page ne scrolle pas globalement —
   chaque colonne porte sa propre CustomScrollbar. */
.maquette {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: var(--sp-4);
  height: 100%;
  overflow: hidden;
}

/* Colonne gauche : l'aperçu témoin seul, sous la doc-bar (padding-top réserve sa
   hauteur, aligné sur ConfigView). Le dock accordéon n'est PAS ici — il est le
   pied du sommaire flottant (`MaquetteStructureNav`) — mais l'aperçu lui réserve
   une bande FIXE (`--maq-dock-h` = hauteur max du stage) et se retire de sa
   gouttière (`--maq-gutter` = largeur du sommaire) : plier ou déplier change la
   hauteur du stage, jamais celle de l'aperçu, dont le FolioView ne se remet donc
   plus à l'échelle à chaque pli. */
.maquette__left {
  --maq-gutter: 15em;
  --maq-dock-h: 13.2em;
  flex: 2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-top: calc(var(--bar-size) + 2em);
  padding-left: 0;
  padding-bottom: calc(var(--maq-dock-h) + var(--sp-4));
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

/* Colonne aside : pleine hauteur, sans cadre propre. Sa CustomScrollbar défile
   SOUS la doc-bar (top-offset = hauteur de barre). Hors flux (la colonne gauche
   prend donc toute la largeur), elle FLOTTE au-dessus des folios : le `z-index`
   la pose devant l'iframe du FolioView, qui porte elle-même `z-index: 1` en
   double-page (cf. `.folio-view--spread .folio-frame`) et passerait sinon devant
   — une planche large (résultats de recherche) allant jusqu'au bord droit. Reste
   SOUS le sommaire flottant (z 160) et les modales (z 200). */
.maquette__aside-col {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  position: absolute;
  z-index: 2;

  right: 0px;
  top: 0px;
  width: 30%;

}

/* Scène du FolioView unique : remplit le main, sert de repère au overlay absolu
   des contrôles liminaire. Même hauteur bornée pour les 3 sources → échelle iso. */
.folio-stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

/* Colonne du folio : le FolioView + son pager. Elle prend toute la scène hors
   recherche ; en recherche elle n'en prend qu'un TIERS — la page de résultats vaut
   une page, le nuage en vaut deux (flex 1 / 2). */
.folio-col {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.folio-stage--search .folio-col {
  flex: 1 1 0;
}

/* Nuage inline : deux pages de large, en regard de la page de résultats. `overflow`
   parce que le SVG du nuage déborde volontiers de sa boîte. */
.maq-cloud {
  flex: 2 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Pager des résultats : discret, sous la page de folio (la molette fait la même
   chose sans se montrer). */
.maq-pager {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding-top: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-muted);
}

.maq-pager__btn {
  display: flex;
  align-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
}

.maq-pager__btn:hover:not(:disabled) {
  color: var(--c-accent-alt);
}

.maq-pager__btn:disabled {
  opacity: var(--op-faint);
  cursor: default;
}

.maq-pager__count {
  font-variant-numeric: tabular-nums;
}

/* Contrôles liminaire (type/côté + découpage) : révélés AU SURVOL de la scène,
   masqués sinon (l'aperçu doit rester lisible au repos). */
.lim-hover__controls {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translate(-50%, 0);
  width: min(100%, 40em);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-card-float);
  backdrop-filter: var(--c-backdrop-filter-blur);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.folio-stage--lim:hover .lim-hover__controls,
.folio-stage--lim:focus-within .lim-hover__controls {
  opacity: 1;
  pointer-events: auto;
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
