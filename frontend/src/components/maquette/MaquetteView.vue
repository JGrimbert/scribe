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
        :listing="isListing"
        @toggle-listing="toggleListing"
        @update:zoom="zoom = $event"
        @update:searching="onSearching"
        @update:query="onQuery"
    />

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

          <!-- Recherche ouverte : la pellicule du livre se replie en onglets et
               rend sa place à un SECOND accordéon, celui de la recherche — un cran
               par section du dashboard d'analyse. Il se pose au bout de la
               première (le panneau démarre à `stripEnd`), et son cran focusé
               décide de la vue montée dans la scène (cf. .maq-analyse). -->
          <template v-if="searching" #panel>
            <MaquetteAccordeon
                v-model:folds="searchFolds"
                :crans="searchCrans"
                :focused="searchFocused"
                :ratio="previewRatio"
                @update:focused="searchFocused = $event"
            >
              <template #spread="{ cran }">
                <MaquetteAnalyseCell :label="cran.label" :ratio="previewRatio" />
              </template>
            </MaquetteAccordeon>
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
                'folio-stage--search': searching,
                'folio-stage--list': isListing,
              }"
          >
            <!-- Barre de scène : elle ne parle plus que de la LISTE (le dézoom,
                 réglage permanent, est monté dans la barre de l'écran). Elle
                 n'existe donc qu'en liste, et le padding-tête de la scène qui lui
                 réserve sa bande suit — hors liste, l'aperçu récupère la hauteur. -->
            <div v-if="isListing" class="maq-scene-bar">
              <span class="maq-scene-bar__label">
                {{ listingNodes.length }} nœud{{ listingNodes.length > 1 ? 's' : '' }}
                · {{ listTally.validables }} validables · {{ listTally.valides }} validés
              </span>
              <!-- Pager : la molette au-dessus des rangées fait la même chose (elle
                   n'appartient à l'iframe qu'au-dessus des PAGES, où elle défile la
                   planche). -->
              <div class="maq-scene-bar__pager">
                <button
                    type="button" class="maq-pager__btn" aria-label="Nœuds précédents"
                    :disabled="listPage === 0" @click="stepListPage(-1)"
                >
                  <i class="pi pi-chevron-up"></i>
                </button>
                <span class="maq-pager__count">{{ listPage + 1 }} / {{ listPageCount }}</span>
                <button
                    type="button" class="maq-pager__btn" aria-label="Nœuds suivants"
                    :disabled="listPage >= listPageCount - 1" @click="stepListPage(1)"
                >
                  <i class="pi pi-chevron-down"></i>
                </button>
              </div>
              <BaseButton variant="ghost" icon="pi-times" title="Replier la liste" @click="listingIndex = null" />
            </div>

            <!-- Pile des rangées. Wrapper PERMANENT (jamais de v-if sur le chemin du
                 FolioView témoin, qui ne doit pas être démonté) : hors liste il ne
                 porte que lui, en liste il empile les nœuds de la page. C'est LUI
                 qu'on mesure (le padding-tête de la barre en est exclu). -->
            <div ref="rowsEl" class="folio-rows" @wheel="onListWheel">
              <!-- Rangée n°1 : le FolioView PERSISTANT. En liste il rend le premier
                   nœud de la page courante — une iframe déjà chaude par page — et sa
                   trame passe en `local` : plein écran, elle continuerait à peindre sa
                   grille (calée sur SES pages) par-dessus les rangées suivantes, qui
                   portent déjà la leur. -->

              <div class="folio-row" :style="listRowStyle">
                <MaquetteNodeIdent
                    v-if="isListing && listPageRows[0]"
                    class="folio-row__id"
                    :node="listPageRows[0]"
                    :rank="listPageRows[0].rank"
                />
                <div class="folio-col">
                  <FolioView
                      class="maq-folio"
                      mode="spread"
                      :visible-pages="folioVisiblePages"
                      :bg-scope="isListing ? 'local' : 'window'"
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
                      :highlight-style="hoveredStyle"
                      @step="stepResultPage"
                      @spread-geometry="spreadGeometry = $event"
                  />

                  <!-- Contrôles de format DOCKÉS sur l'aperçu (l'aside est masquée
                       pour cette source) : cartes ferrées aux bords + traits vers
                       les zones réglées, alimentées par la géométrie émise. -->
                  <MaquetteFormatCallouts
                      v-if="isFormat && !searching && !isListing"
                      :page="fmtPage"
                      :style-defaults="styleDefaults"
                      :geometry="spreadGeometry"
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
              </div>

              <!-- Rangées suivantes de la page. Keyées par leur RANG DANS LA PAGE et
                   non par nœud : changer de page réalimente les mêmes iframes au lieu
                   de les détruire et de les rebâtir. `bg-scope="local"` obligatoire —
                   en `fixed`, chaque rangée peindrait sa trame sur toute la fenêtre. -->
              <div
                  v-for="(row, slot) in listPageRows.slice(1)"
                  :key="slot"
                  class="folio-row"
                  :style="listRowStyle"
              >
                <MaquetteNodeIdent class="folio-row__id" :node="row" :rank="row.rank" />
                <div class="folio-row__folio">
                  <FolioView
                      class="maq-folio"
                      mode="spread"
                      bg-scope="local"
                      :visible-pages="folioVisiblePages"
                      :node-id="row.nodeId"
                      :depth="mainDepth"
                      :data="documentData"
                      :visuals="effectiveVisuals"
                      :page="previewPage"
                      :margins="previewMargins"
                      :hyphenation="styleDefaults.hyphenation"
                      :running-titles="previewRunningTitles"
                      :book-title="bookTitle"
                      :highlight-style="hoveredStyle"
                  />
                </div>
              </div>
            </div>

            <!-- Vue de la section d'analyse focusée dans l'accordéon de recherche,
                 en regard des résultats sur deux pages de largeur. C'est la CARD du
                 dashboard, montée telle quelle (elle porte ses propres états
                 vide/révélation) — sauf le Vocabulaire, dont on garde le nuage nu,
                 déjà réglé pour cette boîte. -->
            <div
                v-if="searching"
                ref="cloudEl"
                class="maq-analyse"
            >
              <VocabulaireCloud
                  v-if="isCloudView"
                  compact
                  :width="cloudW"
                  :dims="CLOUD_DIMS"
              />
              <CustomScrollbar v-else-if="analyseCard" class="maq-analyse__scroll">
                <component :is="analyseCard" />
              </CustomScrollbar>
              <p v-else class="maq-analyse__empty">{{ focusedAnalyse?.label }}</p>
            </div>

            <!-- Colonne 1/3 des blocs d'analyse, sortie du bloc : posée EN
                 ABSOLU par-dessus la planche, ferrée à droite. Chaque card y
                 téléporte son `#aside` (cf. AnalyseBlock, `analyseAsideTo`) ;
                 seul le Vocabulaire pose la sienne à la main — la scène monte
                 son nuage NU, sa card n'est donc jamais montée pour le faire. -->
            <div v-if="searching" class="maq-analyse-aside">
              <CustomScrollbar>
                <div ref="analyseAsideEl" class="maq-analyse-aside__inner split-aside">
                  <template v-if="isCloudView">
                    <OccurrencesCard />
                    <SemantiqueCard />
                  </template>
                </div>
              </CustomScrollbar>
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
    <!-- Format : l'aside est masquée, l'écran se pilote par les callouts dockés
         sur l'aperçu (cf. MaquetteFormatCallouts). -->
    <div v-show="!searching && !isFormat" class="maquette__aside-col" @wheel.prevent="onAsideWheel">
      <!-- 84 = les DEUX barres (doc-bar + barre de la maquette) : la track démarre
           sous elles, la colonne défile derrière. -->
      <CustomScrollbar :top-offset="84">
        <MaquetteAside
            :fmt-page="fmtPage"
            :style-defaults="styleDefaults"
            :lim-styles="limSpreadStyles"
            @hover-style="hoveredStyle = $event"
            :elig="limElig"
            :lim-can-extend="limCanExtend"
            :lim-next-title="limNextTitle"
            :lim-border-shift="limBorderShift"
            :chap-sections="chapSections"
            :style-roles="styles"
            :rules="rules"
            :highlight-items="inventory.highlights"
            :highlights="highlights"
            :zoned="zoned"
            :active-block="focusedCran?.seriesKey ?? null"
            :model-names="modelNames"
            :model-label="witnessItem?.titre ?? null"
            :tally-rows="chapTallyRows"
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
import MaquetteAnalyseCell from './MaquetteAnalyseCell.vue'
import MaquetteAside from './MaquetteAside.vue'
import MaquetteFormatCallouts from './MaquetteFormatCallouts.vue'
import MaquetteNodeIdent from './MaquetteNodeIdent.vue'
import MaquetteStructureNav from './MaquetteStructureNav.vue'
import MaquetteBar from './MaquetteBar.vue'
import VocabulaireCloud from '../analyse/lexical/VocabulaireCloud.vue'
import OccurrencesCard from '../analyse/lexical/OccurrencesCard.vue'
import SemantiqueCard from '../analyse/semantic/SemantiqueCard.vue'
import FolioView from '../editor/FolioView.vue'
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'
import BaseButton from '../ui/atoms/BaseButton.vue'
import PageDiagram from '../config/PageDiagram.vue'
import StyleEditorPanel from '../config/StyleEditorPanel.vue'
import AccordeonControls from '../liminaire/AccordeonControls.vue'
import LiminaireDecoupage from '../liminaire/LiminaireDecoupage.vue'
import { effectivePage, effectiveMargins } from '../../script/pageFormats'
import { pathToInAxes } from '../../script/trame'
import { useTypologyConfig } from '../../composables/useTypologyConfig'
import { useLiminaireBornes } from '../../composables/useLiminaireBornes'
import { useLiminaireComposition } from '../../composables/useLiminaireComposition'
import { useAnalyse } from '../../composables/useAnalyse'
import { useDocSearch } from '../../composables/useDocSearch'
import { useDocStats } from '../../composables/useDocStats'
import { visibleSections } from '../../script/analyseSections'
import { ANALYSE_CARDS } from '../analyse/analyseCards'
import { fragmentPages } from '../../script/searchFragment'
import { spreadStyles } from '../../script/liminaire-styles'
import { modelStyleNames } from '../../script/chapitrageModele'
import { evaluateNode, levelConstraints, tallyByDepth } from '../../script/chapitrageValidation'

const route = useRoute()

// ── État de configuration (partagé avec l'écran config) ─────────────────────
// Même composable que la config : `load` peuple tout (styles, rules, sections,
// styleDefaults, liminaireConfig…), muté en place, `save` persiste d'un coup.
const trame = inject('documentTrame', null)
const documentData = inject('documentData', null)
const documentTitle = inject('documentTitle', null)

const {
  styles, rules, liminaireConfig, styleDefaults, sections,
  inventory, highlights, zoned, structureShapes,
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

  // Validation ferme la marche : elle ouvre la zone « Annotations », dernière de
  // la pellicule (ce qu'on dit du texte, après ce qui le compose).
  out.push({ key: 'validation', label: 'Validation', spreads: [{ sourceKey: 'validation' }] })
  return out
})

// Section d'accordéon d'une série : Format · Liminaire · Chapitrage (tous les
// niveaux de chapitrage fondus en UNE section, sans séparation visuelle interne)
// · Annotations.
function sectionOf(seriesKey) {
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

// Recherche ouverte → l'accordéon se réduit à ses onglets (il rend sa place au
// panneau). C'est un EFFET de la recherche, pas une préférence : à la fermeture,
// le pli automatique reprend la main.
const searching = ref(false)

// Zone d'accordéon du cran focusé (à ne pas confondre avec `focusedSection`, la
// section de CHAPITRAGE focusée).
const focusedZoneKey = computed(() => focusedCran.value?.sectionKey ?? null)

// Rétraction automatique : quitter une zone l'empile (feuillets recouverts à
// 95 %), seule celle du cran focusé reste dépliée. L'animation est déjà portée
// par l'accordéon (transform sur la zone et ses feuillets).
function applyAutoFolds() {
  folds.value = Object.fromEntries(
    sectionKeys.value.map((k) => [k, k === focusedZoneKey.value ? 'open' : 'stack']),
  )
}

// On ne réapplique QU'au changement de zone (et à l'apparition d'une zone, quand
// les données arrivent après coup) : un pli posé à la main sur l'onglet reste
// souverain tant qu'on ne change pas de zone. Volontairement pas sur
// `sectionKeys` lui-même — ce computed se recrée à chaque recomposition des crans
// (extension du liminaire…) et écraserait ce pli manuel.
watch(
  [focusedZoneKey, () => sectionKeys.value.join('|')],
  () => { if (!searching.value) applyAutoFolds() },
  { immediate: true },
)
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

// ── Accordéon de la recherche : un cran par section du dashboard d'analyse ───
// Même composant que la pellicule du livre (mêmes onglets, même molette), monté
// dans l'espace que celle-ci libère en se repliant. Une seule zone : sept zones
// d'un cran feraient une pellicule bien plus large que la place disponible.
const { isRevealed, revealAll } = useAnalyse()
// La chaîne de révélation est l'entrée du DASHBOARD (une card après l'autre, sur
// signal). Ici personne ne la lance : sans ça, chaque `AnalyseBlock` monté dans la
// scène reste invisible, données présentes ou non. On révèle donc tout d'emblée.
onMounted(revealAll)
// La colonne 1/3 des blocs ne tient pas dans la scène : les blocs la TÉLÉPORTENT
// dans le panneau flottant ferré à droite (cf. AnalyseBlock, `analyseAsideTo`).
// L'élément n'existe qu'en recherche — d'où un ref, que le Teleport attend.
const analyseAsideEl = ref(null)
provide('analyseAsideTo', analyseAsideEl)
// La scène a une hauteur BORNÉE (cf. .maq-analyse) : les blocs l'épousent et
// leurs viz se réduisent pour y tenir, au lieu de se dimensionner sur leur
// contenu et de déborder (cf. `.split--fit`).
provide('analyseFit', true)

const analyseSections = computed(() => visibleSections(isRevealed))
const searchCrans = computed(() =>
  analyseSections.value.map((s, i) => ({
    sourceKey: 'analyse',
    key: s.key,
    label: s.label,
    sectionKey: 'analyse',
    sectionLabel: 'Analyse',
    isSectionStart: i === 0,
  })),
)
const searchFocused = ref(0)
const searchFolds = ref({})
// La section dont la VUE est montée dans la scène (à droite des résultats), et la
// card correspondante. Le Vocabulaire fait exception : on y monte le nuage NU (la
// card entière lui adjoindrait occurrences + proximité, deux colonnes de trop ici).
const focusedAnalyse = computed(() => analyseSections.value[searchFocused.value] ?? null)
const isCloudView = computed(() => focusedAnalyse.value?.key === 'vocabulaire')
const analyseCard = computed(() => ANALYSE_CARDS[focusedAnalyse.value?.key] ?? null)

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

function onSearching(active) {
  searching.value = active
  if (active) {
    // La planche de résultats prend la scène : la liste d'un niveau n'y a plus sa place.
    listingIndex.value = null
    folds.value = Object.fromEntries(sectionKeys.value.map((k) => [k, 'tab']))
  } else {
    applyAutoFolds()
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
// par un modèle relevé/exigé). C'est de lui que l'aside relève le modèle — la
// liste peut paginer sous les yeux sans que les tables changent de référence.
const modelNodeId = computed(() => {
  if (focusedSourceKey.value !== 'chapitrage') return null
  const dk = focusedSection.value?.depthKey
  return dk == null ? null : firstNodeAtDepthKey(dk)
})

// Nœud rendu par le FolioView persistant : le nœud de référence, ou — liste
// déroulée — le premier nœud de la PAGE courante (la rangée n°1 est ce folio).
const currentNodeId = computed(() => {
  if (isListing.value) return listPageRows.value[0]?.nodeId ?? null
  if (focusedSourceKey.value !== 'chapitrage') return null
  return modelNodeId.value
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
// updateSpreadBg). Recherche : la planche ne porte qu'UNE page de résultats (cf.
// RESULTS_PER_PAGE), le dézoom part donc d'une page et non d'un vis-à-vis.
const ZOOMS = [1, 2, 3, 4, 6]
const zoom = ref(1)
const folioVisiblePages = computed(() => (searching.value ? 1 : 2) * zoom.value)

// ── Liste des nœuds d'un niveau (en place, pas en fenêtre) ──────────────────
// L'action d'en-tête de l'aside ne monte plus de couche par-dessus la maquette :
// le témoin devient la rangée n°1 de la liste des nœuds du niveau, et la scène se
// dézoome pour les accueillir. `null` = liste repliée.
const listingIndex = ref(null)

const listingChap = computed(() => {
  const i = listingIndex.value
  const sec = i == null ? null : chapSections.value[i]
  return sec ? { index: i, sec } : null
})
const isListing = computed(() => listingChap.value !== null)

// Les nœuds du niveau, chacun avec son verdict (contraintes de styles) et son
// état de validation manuelle — une rangée par nœud, la n°1 étant le témoin.
const listingNodes = computed(() => {
  const dk = listingChap.value?.sec.depthKey
  if (dk == null) return []
  const constraints = constraintsByDepth.value[dk]
  return nodesAtDepthKey(dk).map((n) => ({
    ...n,
    ...evaluateNode(shapeByNode.value.get(n.nodeId) ?? null, constraints, titleStyleOf(n.nodeId)),
    state: validations?.value?.[n.nodeId] ?? null,
  }))
})

function toggleListing(index) {
  const next = listingIndex.value === index ? null : index
  listingIndex.value = next
  // Une liste a besoin de place : on dézoome si la scène est encore à la planche
  // d'ouverture. Ensuite le réglage reste à la main de l'utilisateur (on ne le
  // remet pas à ×1 en repliant).
  if (next !== null && zoom.value === 1) zoom.value = 3
}

// La liste suit le cran focusé : passer à un autre niveau la rebranche dessus
// (le témoin change de toute façon), quitter le chapitrage la replie.
watch(focusedCran, (c) => {
  if (listingIndex.value === null) return
  listingIndex.value = c?.sourceKey === 'chapitrage' ? c.sectionIndex : null
})

// Décompte du niveau listé : les nœuds portent déjà leur verdict.
const listTally = computed(() => ({
  validables: listingNodes.value.filter((n) => n.validable).length,
  valides: listingNodes.value.filter((n) => n.state === 'validé').length,
}))

// Géométrie d'une rangée : le dézoom fixe la LARGEUR d'une page, donc sa hauteur
// (ratio du format), donc celle de la rangée — et le nombre de rangées qui
// tiennent dans la pile. Sans hauteur posée, des rangées à hauteur égale se
// partageraient la scène et c'est la HAUTEUR qui bornerait l'échelle : le dézoom
// demandé ne serait jamais atteint.
const SPREAD_PAD = 12 // respiration réservée DANS la frame (cf. useFolioScale)
const ROW_GAP = 12 // --sp-3
const ID_COL_EM = 12 // largeur de la colonne d'identité
// Plafond de rangées vivantes = iframes Paged.js simultanées (~900 Ko chacune).
// Ce n'est PAS la mise en page (le dézoom décide du nombre de rangées) : ce
// plafond ne fait que borner la facture quand elles deviennent minuscules.
const LIST_MAX_ROWS = 6
const rowsEl = ref(null)
const rowsW = ref(0)
const rowsH = ref(0)
let rowsRo = null
watch(rowsEl, (el) => {
  rowsRo?.disconnect()
  if (!el) { rowsRo = null; return }
  const measure = () => { rowsW.value = el.clientWidth; rowsH.value = el.clientHeight }
  measure()
  rowsRo = new ResizeObserver(measure)
  rowsRo.observe(el)
}, { immediate: true })
onUnmounted(() => rowsRo?.disconnect())

const listRowHeight = computed(() => {
  if (!isListing.value || !rowsW.value || !rowsEl.value) return 0
  const em = parseFloat(getComputedStyle(rowsEl.value).fontSize) || 16
  const folioW = rowsW.value - ID_COL_EM * em - ROW_GAP - 2 * SPREAD_PAD
  if (folioW <= 0) return 0
  return Math.round((folioW / folioVisiblePages.value) / previewRatio.value) + 2 * SPREAD_PAD
})

// Hauteur posée en inline sur chaque rangée (hors liste : aucune, la rangée
// unique remplit la scène comme avant).
const listRowStyle = computed(() =>
  isListing.value && listRowHeight.value ? { height: `${listRowHeight.value}px` } : null,
)

// ── Pagination des rangées ──────────────────────────────────────────────────
// PAGINÉ, pas défilé : une rangée = une iframe Paged.js, on en borne le nombre
// vivant. La rangée n°1 de chaque page est le FolioView persistant.
const listPage = ref(0)
const listRowsPerPage = computed(() => {
  if (!listRowHeight.value || !rowsH.value) return 1
  const fits = Math.floor((rowsH.value + ROW_GAP) / (listRowHeight.value + ROW_GAP))
  return Math.min(Math.max(fits, 1), LIST_MAX_ROWS)
})
const listPageCount = computed(() =>
  Math.max(1, Math.ceil(listingNodes.value.length / listRowsPerPage.value)),
)
const listPageRows = computed(() => {
  const start = listPage.value * listRowsPerPage.value
  return listingNodes.value
    .slice(start, start + listRowsPerPage.value)
    .map((n, i) => ({ ...n, rank: start + i + 1 }))
})

function stepListPage(dir) {
  listPage.value = Math.min(Math.max(listPage.value + dir, 0), listPageCount.value - 1)
}

// Changer de dézoom change le nombre de rangées : on garde le même endroit du
// livre sous les yeux plutôt que le même NUMÉRO de page.
watch(listRowsPerPage, (n, prev) => {
  if (prev) listPage.value = Math.floor((listPage.value * prev) / n)
})
// Le niveau change (ou les nœuds arrivent après coup) : la page peut tomber hors
// bornes ; ouvrir la liste la reprend à son début.
watch(listPageCount, (n) => { if (listPage.value > n - 1) listPage.value = n - 1 })
watch(listingIndex, () => { listPage.value = 0 })

// Un « flick » de molette émet plusieurs events : sans verrou on sauterait
// plusieurs pages — et chaque saut repagine `listRowsPerPage` iframes. Seule la
// gouttière et la colonne d'identité voient la molette : au-dessus des pages,
// elle appartient à l'iframe (qui défile la planche).
let listWheelLock = false
function onListWheel(e) {
  if (!isListing.value) return
  e.preventDefault()
  if (listWheelLock) return
  const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0
  if (!dir) return
  stepListPage(dir)
  listWheelLock = true
  setTimeout(() => { listWheelLock = false }, 350)
}

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

// Styles du vis-à-vis focusé, pour SA table dans l'aside : le liminaire n'a pas de
// niveau (une seule zone pour toutes les planches), la table suit donc la planche
// et non la zone. Résolus contre l'inventaire de la zone pour garder ce que la
// table en sait (échantillon, styles déclarés à la main).
const liminaireInventory = computed(
  () => sections.value.find((s) => s.zone.key === 'liminaire')?.styles ?? [],
)
const limSpreadStyles = computed(() => spreadStyles(limFocusedSpread.value, liminaireInventory.value))

// Style survolé dans une table de l'aside → surligné dans l'aperçu (teal + pointillé
// posé en dehors, cf. buildHighlightCss). Relâché au changement de cran : la table
// disparaît sans que la souris la quitte, son `mouseleave` ne partirait jamais.
const hoveredStyle = ref(null)
watch(focused, () => { hoveredStyle.value = null })

// ── Source 1 : format de page ──────────────────────────────────────────────
// Relevé .odt brut (fourni par DocumentLayout), point de départ de l'aperçu.
const documentPageOdt = inject('documentPageOdt', null)
const fmtPage = computed(() => documentPageOdt?.value ?? null)

// Géométrie de la planche (rects écran des pages), émise par le FolioView
// persistant : alimente les ancres des callouts de format dockés sur l'aperçu.
const spreadGeometry = ref(null)

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
// Validation : même double page vide que le format, mais SANS la croix
// d'empagement — elle parle du gabarit, hors sujet pour des règles.
const isValidation = computed(() => focusedSourceKey.value === 'validation')

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
  // Liste déroulée : la rangée n°1 rend un NŒUD (nodeId + depth), jamais une planche.
  if (isListing.value) return null
  if (isFormat.value || isValidation.value) return formatSpreadPages
  if (isLiminaire.value) return limSpreadPages.value
  return null
})
const mainNodeId = computed(() => currentNodeId.value)
const mainDepth = computed(() => {
  if (isListing.value) return listingChap.value?.sec.depthKey ?? 0
  return focusedSourceKey.value === 'chapitrage' ? (focusedSection.value?.depthKey ?? 0) : 0
})

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
  /* Sous les DEUX barres : la doc-bar et la barre de la maquette (MaquetteBar). */
  padding-top: calc(2 * var(--bar-size) + 1em);
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
   des contrôles liminaire. Même hauteur bornée pour les 3 sources → échelle iso.
   Le padding-tête ne réserve la bande de la barre de scène (posée en absolu) que
   là où celle-ci existe : en liste. */
.folio-stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.folio-stage--list {
  padding-top: 2.2em;
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

/* Pile des rangées : neutre hors liste (elle ne porte que le folio témoin, qui
   remplit la scène comme avant). En liste, le nombre de rangées est calculé pour
   tenir dans sa hauteur ; l'`overflow` ne couvre que le tick où la mesure n'est
   pas encore faite. */
.folio-rows {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Rangée : hors liste elle remplit la pile ; en liste sa hauteur est posée en
   inline (dérivée du dézoom, cf. listRowHeight) et c'est ELLE qui décide de
   l'échelle des pages, pas le partage de la hauteur disponible. */
.folio-row {
  display: flex;
  align-items: stretch;
  gap: var(--sp-3);
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.folio-stage--list .folio-row {
  flex: 0 0 auto;
}

.folio-row__id {
  flex: 0 0 12em;
}

.folio-row__folio {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
}


/* Hors liste, la planche réserve 16em de part et d'autre (elle vit dans une
   colonne large, à côté de l'aside). En liste les rangées sont ferrées à gauche :
   le dézoom n'aurait aucun intérêt s'il fallait défiler pour voir la 1re page. */
.folio-stage--list :deep(.folio-view--spread .folio-pad) {
  padding: 0 4em 0 0;
}

/* Barre de scène : l'état de la liste (compte, pager, repli), discrète, en tête
   de scène. Les réglages permanents de l'écran, eux, vivent dans MaquetteBar. */
.maq-scene-bar {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.maq-scene-bar__label {
  color: var(--c-muted);
  font-variant-numeric: tabular-nums;
}

.maq-scene-bar__pager {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

/* Vue de la section d'analyse focusée (nuage compris) : deux pages de large, en
   regard de la page de résultats. `overflow` parce que le SVG du nuage déborde
   volontiers de sa boîte.
   Bornée EN HAUT ET EN BAS plutôt qu'à une hauteur choisie : la boîte se calcule
   sur la fenêtre et s'arrête au-dessus du dock, sans valeur à réajuster à la main.
   Sans `bottom`, une card haute filait sous le bas de l'écran sans jamais défiler
   (`.maquette` est en `overflow: hidden`). `--maq-dock-h` est hérité de
   `.maquette__left`. */
.maq-analyse {
  flex: 2 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  position: fixed;

  right: 0px;
  /* `fixed` = calé sur le viewport : le décalage compte la pile de barres, dont
     la troisième (MaquetteBar) fait partie. */
  top: calc(4em + var(--bar-size));
  bottom: calc(var(--maq-dock-h) + var(--sp-4));
  width: 60%;
  /* Au-dessus de l'iframe du folio, qui porte `z-index: 1` en double-page (cf.
     .folio-view--spread .folio-frame) et passerait sinon devant — la vue est
     positionnée, mais sans z-index elle perdrait l'empilement. */
  z-index: 2;
}

.maq-analyse__scroll {
  height: 100%;
}

/* Colonne des asides d'analyse : posée PAR-DESSUS la planche (z 3, au-dessus de
   `.maq-analyse` à 2), ferrée au bord droit, sur la même bande verticale que la
   vue qu'elle commente. Carte flottante, comme les contrôles liminaire et le
   sommaire — elle se lit comme posée, pas comme une troisième colonne. */
.maq-analyse-aside {
  position: fixed;
  right: 0;
  top: calc(4em + var(--bar-size));
  bottom: calc(var(--maq-dock-h) + var(--sp-4));
  width: 22em;
  max-width: 40%;
  z-index: 3;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-card-float);
  backdrop-filter: var(--c-backdrop-filter-blur);
}

/* Boîte d'accueil du Teleport. Respiration et séparateurs viennent de
   `.split-aside` (analyse.css) : la colonne se lit comme celle du dashboard,
   d'où qu'elle soit rendue. */
.maq-analyse-aside__inner {
  padding-block: var(--sp-2);
}

/* Vue pas encore montée : le nom de la section, discrètement — la place lui est
   réservée, elle est vide, ça doit se lire comme tel. */
.maq-analyse__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 8em;
  margin: 0;
  color: var(--c-muted);
  font-size: var(--fs-sm);
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
