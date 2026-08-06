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
        @validate="toggleValidation"
        @recalibrate="startRecalibration"
        @update:zoom="zoom = $event"
        @update:searching="onSearching"
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
              }"
          >
            <div class="folio-col">
              <FolioView
                  class="maq-folio"
                  mode="spread"
                  :visible-pages="folioVisiblePages"
                  :body-cross="isFormat && !searching"
                  :bare-pages="searching"
                  :clamp-entries="isLiminaire"
                  :cap-pages="isChapitrage && !searching ? 2 : 0"
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
                  @block-geometry="blockGeometry = $event"
                  @style-geometry="styleGeometry = $event"
              />

              <!-- Validation : aperçu LÉGER (hors Paged.js) du nœud survolé dans la
                   liste des familles, posé par-dessus le témoin du modèle. -->
              <MaquetteFragmentPreview
                  v-if="showGroupes && hoveredNode"
                  :node="hoveredNode"
                  :node-id="hoveredGroup?.nodes[0]?.nodeId ?? null"
                  :depth="mainDepth"
                  :visuals="effectiveVisuals"
                  :ratio="previewRatio"
              />

              <!-- Contrôles de format DOCKÉS sur l'aperçu (l'aside est masquée
                   pour cette source) : cartes ferrées aux bords + traits vers
                   les zones réglées, alimentées par la géométrie émise. -->
              <MaquetteFormatCallouts
                  v-if="isFormat && !searching"
                  :page="fmtPage"
                  :style-defaults="styleDefaults"
                  :geometry="spreadGeometry"
              />
              <!-- Styles du vis-à-vis posés SUR la planche (callouts ferrés au rail
                   droit, fuyante vers le texte via `data-style`). Liminaire : « ce qui
                   précède ». Chapitrage : + « exigé ». L'aside garde sa table en
                   parallèle (à retirer une fois validé en navigateur). -->
              <MaquetteStyleCallouts
                  v-if="isLiminaire && !searching"
                  :geometry="spreadGeometry"
                  :style-geometry="styleGeometry"
                  :styles="limSpreadStyles"
                  :style-roles="styles"
                  zone-key="liminaire"
                  @hover-style="hoveredStyle = $event"
              />
              <MaquetteStyleCallouts
                  v-if="isChapitrage && !searching"
                  :geometry="spreadGeometry"
                  :style-geometry="styleGeometry"
                  :styles="chapSpreadStyles"
                  :style-roles="styles"
                  show-require
                  :depth-key="focusedSection?.depthKey ?? null"
                  :zone-key="focusedSection?.zone.key ?? null"
                  :rule-set="focusedSection?.ruleSet ?? rules.default"
                  @hover-style="hoveredStyle = $event"
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
            <!-- Contrôles liminaire posés SUR la planche (select de type + chevrons),
                 révélés au survol. Ancrés sur la géométrie émise par le FolioView. -->
            <div v-if="isLiminaire" class="lim-hover__controls">
              <LiminaireControls
                  :geometry="spreadGeometry"
                  :block-geometry="blockGeometry"
                  :spread="limFocusedSpread"
                  :types="limTypes"
                  :suggestions="limSuggestions"
                  :config="liminaireConfig"
                  :focused="limFocused"
                  :spread-count="limSpreads.length"
                  @set-type="limSetType"
                  @update:focused="setLimFocused"
              />
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
    <!-- Aside réservée à la VALIDATION (règles + surlignages). Format, liminaire et
         chapitrage se pilotent désormais par les callouts posés SUR la planche
         (MaquetteFormatCallouts / MaquetteStyleCallouts) — leurs tables d'aside ont
         été retirées. -->
    <div v-show="!searching && isValidation" class="maquette__aside-col" @wheel.prevent="onAsideWheel">
      <!-- 84 = les DEUX barres (doc-bar + barre de la maquette) : la track démarre
           sous elles, la colonne défile derrière. -->
      <CustomScrollbar :top-offset="84">
        <MaquetteAside
            :rules="rules"
            :highlight-items="inventory.highlights"
            :highlights="highlights"
            :zoned="zoned"
            :active-block="focusedCran?.seriesKey ?? null"
        />
      </CustomScrollbar>
    </div>

    <!-- Validation : les familles de cas du niveau, ferrées EN BAS de la fenêtre.
         Elles portent leur PROPRE aside : la table des styles hors modèle, sortie
         de l'aside principale. En SUR-IMPRESSION du bas de la scène (pas de
         réserve de place) — cliquer « Valider » ne doit pas redimensionner le
         folio (donc ne pas dézoomer les pages). -->
    <MaquetteGroupes
        v-if="showGroupes"
        class="maq-groupes-zone"
        :groups="deviationGroups"
        :hovered="hoveredGroup?.key ?? null"
        :suggestion="mergeSuggestion"
        :corps-suggestion="corpsSuggestion"
        :merging="merging"
        :style-rows="styleRows"
        :style-roles="styles"
        :depth-key="focusedSection?.depthKey ?? 0"
        :zone-key="focusedSection?.zone.key ?? null"
        :rule-set="focusedSection?.ruleSet ?? rules.default"
        @hover-group="onHoverGroup"
        @merge="applyMerge"
        @hover-style="hoveredStyle = $event"
    />

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
import MaquetteStyleCallouts from './MaquetteStyleCallouts.vue'
import MaquetteGroupes from './MaquetteGroupes.vue'
import MaquetteFragmentPreview from './MaquetteFragmentPreview.vue'
import MaquetteStructureNav from './MaquetteStructureNav.vue'
import MaquetteBar from './MaquetteBar.vue'
import VocabulaireCloud from '../analyse/lexical/VocabulaireCloud.vue'
import OccurrencesCard from '../analyse/lexical/OccurrencesCard.vue'
import SemantiqueCard from '../analyse/semantic/SemantiqueCard.vue'
import FolioView from '../editor/FolioView.vue'
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'
import PageDiagram from '../config/PageDiagram.vue'
import StyleEditorPanel from '../config/StyleEditorPanel.vue'
import RecalibrationModal from '../config/RecalibrationModal.vue'
import UiCallout from '../ui/atoms/UiCallout.vue'
import LiminaireControls from '../liminaire/LiminaireControls.vue'
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
import { visibleSections } from '../../script/analyseSections'
import { ANALYSE_CARDS } from '../analyse/analyseCards'
import { fragmentPages } from '../../script/searchFragment'
import { spreadStyles } from '../../script/liminaire-styles'
import { modelStyleNames } from '../../script/chapitrageModele'
import { levelConstraints, tallyByDepth } from '../../script/chapitrageValidation'
import { groupByDeviation } from '../../script/chapitrageGroupes'
import { mergeCandidates, corpsMergeCandidates, deviationStyleRows } from '../../script/chapitrageFusion'

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
// updateSpreadBg). Recherche : la planche ne porte qu'UNE page de résultats (cf.
// RESULTS_PER_PAGE), le dézoom part donc d'une page et non d'un vis-à-vis.
const ZOOMS = [1, 2, 3, 4, 6]
const zoom = ref(1)
const folioVisiblePages = computed(() => (searching.value ? 1 : 2) * zoom.value)

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

// ── Source 1 : format de page ──────────────────────────────────────────────
// Relevé .odt brut (fourni par DocumentLayout), point de départ de l'aperçu.
const documentPageOdt = inject('documentPageOdt', null)
const fmtPage = computed(() => documentPageOdt?.value ?? null)

// Géométrie de la planche (rects écran des pages), émise par le FolioView
// persistant : alimente les ancres des callouts de format dockés sur l'aperçu.
const spreadGeometry = ref(null)
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
// Validation : même double page vide que le format, mais SANS la croix
// d'empagement — elle parle du gabarit, hors sujet pour des règles.
const isValidation = computed(() => focusedSourceKey.value === 'validation')
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
  if (isFormat.value || isValidation.value) return formatSpreadPages
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
  /* Gouttière du sommaire + hauteur du dock + hauteur du volet de validation :
     hissées ici pour être vues À LA FOIS par la colonne gauche et par le volet
     groupes ferré au viewport (cf. .maq-groupes-zone). */
  --maq-gutter: 15em;
  --maq-dock-h: 13.2em;
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
   pied du sommaire flottant (`MaquetteStructureNav`) — mais l'aperçu lui réserve
   une bande FIXE (`--maq-dock-h` = hauteur max du stage) et se retire de sa
   gouttière (`--maq-gutter` = largeur du sommaire) : plier ou déplier change la
   hauteur du stage, jamais celle de l'aperçu, dont le FolioView ne se remet donc
   plus à l'échelle à chaque pli. */
.maquette__left {
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

/* Volet des familles de cas : ferré EN BAS de la fenêtre, remontant assez haut
   pour RECOUVRIR le bas de la planche du folio (`--maq-groupes-h` en `vh`). Il
   passe DEVANT l'accordéon (dock, z 160) — la validation prend le pas sur la
   pellicule — tout en restant sous les modales (z 200). Depuis la gouttière du
   sommaire (`left`) jusqu'au bord droit. En `rem` et non en `em` : le volet pose
   sa propre `font-size` (--fs-sm), des marges en `em` s'y rapporteraient. */
.maq-groupes-zone {
  position: fixed;
  left: 17rem;
  right: 0em;
  bottom: 0em;
  height: var(--maq-groupes-h);
  z-index: 165;
  /* Fond/flou portés par la seule bande fusion+liste (cf. .maq-groupes__families),
     pas par le volet entier — l'aside hors modèle reste transparente. */
  padding-top: var(--sp-4);
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

/* Recherche : la scène est PARTAGÉE — la vue d'analyse est ferrée à droite sur
   60 % de la fenêtre. Centrer la page de résultats la ferait glisser dessous. */
.folio-stage--search :deep(.folio-view--spread .folio-pad) {
  margin-inline: 0;
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

/* Overlay des contrôles liminaire, posé SUR la planche (select de type, chevrons,
   outlines des éléments + flèches de découpage). Visible EN PERMANENCE — les
   outlines des éléments doivent l'être (cf. LiminaireControls, qui gate lui-même
   les flèches au survol de leur outline). Racine inerte : chaque contrôle
   rétablit le pointeur lui-même. */
.lim-hover__controls {
  position: absolute;
  inset: 0;
  /* Au-dessus de l'iframe du FolioView (z-index 1 en double-page) : sans ça, les
     contrôles posés sur les pages passeraient DERRIÈRE le folio. */
  z-index: 3;
  pointer-events: none;
}

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
