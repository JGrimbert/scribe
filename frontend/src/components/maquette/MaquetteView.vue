<template>
  <!-- Écran Maquette. Deux colonnes (2/3 main · 1/3 aside) qui se remplissent des
       inputs de la SOURCE focusée dans l'accordéon ; en bas, hors du flux et collé
       au bord, un dock accordéon (pellicule de crans).
       ITÉRATION 4 : sources 1 (format) · 2 (Liminaire) · 3 (Chapitrage, un cran
       par niveau) branchées. La table des styles vit dans l'aside, l'aperçu témoin
       dans le main. Persistance via l'action « Enregistrer » de la doc-bar
       (`save` du composable) ; la borne liminaire reste un aperçu (recalibration
       seule la déplace, non branchée ici). -->
  <div class="maquette">
    <div class="maquette__panels">
      <AnalyseBlock aside="right" bare>
        <template #main>
          <!-- Scroll propre à la colonne (le DS proscrit les barres natives) : la
               page ne scrolle plus globalement, chaque colonne défile chez elle. -->
          <CustomScrollbar class="maquette__col">
          <!-- Source 1 — l'aperçu au centre, dimensions au-dessus, marges en cadre. -->
          <section v-if="focusedSourceKey === 'maquette'" class="maquette__main">
            <h2 class="maquette__title">Maquette — format de page</h2>
            <MaquetteFormatFrame :page="fmtPage" :style-defaults="styleDefaults" />
          </section>

          <!-- Source 2 — Liminaire (hybride) : la planche focusée (schéma
               d'imposition + vrai Paged.js pour le contenu) ; les contrôles
               type/côté + découpage se révèlent AU SURVOL de l'aperçu. -->
          <section v-else-if="focusedSourceKey === 'liminaire'" class="maquette__main">
            <h2 class="maquette__title">Liminaire</h2>
            <div class="lim-hover">
              <MaquetteLiminaireSpread
                  :spread="limFocusedSpread"
                  :types="limTypes"
                  :suggestions="limSuggestions"
                  :visuals="effectiveVisuals"
                  :page="previewPage"
                  :margins="previewMargins"
                  :hyphenation="styleDefaults.hyphenation"
                  :running-titles="previewRunningTitles"
                  :book-title="bookTitle"
                  :ratio="previewRatio"
              />
              <div class="lim-hover__controls">
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

          <!-- Source 3 — Chapitrage : aperçu témoin + modèles du niveau focusé. -->
          <section v-else-if="focusedSourceKey === 'chapitrage' && focusedSection" class="maquette__main">
            <h2 class="maquette__title">{{ focusedSection.zone.label }}</h2>
            <MaquetteChapitrage
                :section="focusedSection"
                :shapes-error="shapesError"
                :data="documentData"
                :visuals="effectiveVisuals"
                :page="previewPage"
                :margins="previewMargins"
                :hyphenation="styleDefaults.hyphenation"
                :running-titles="previewRunningTitles"
                :book-title="bookTitle"
            />
          </section>

          <!-- Sources restantes — placeholder. -->
          <section v-else class="maquette__main">
            <h2 class="maquette__title">{{ focusedTitle }}</h2>
            <p class="maquette__placeholder">
              Inputs du composant relatif à la source focusée — à câbler.
            </p>
          </section>
          </CustomScrollbar>
        </template>

        <template #aside>
          <CustomScrollbar class="maquette__col">
          <aside v-if="focusedSourceKey === 'maquette'" class="maquette__aside">
            <h3 class="maquette__aside-title">En-têtes et pieds</h3>
            <div class="fmt-bands">
              <RunningBandControl :band="styleDefaults.runningTitles.header" label="En-tête" icon="pi-angle-up" always-open />
              <RunningBandControl :band="styleDefaults.runningTitles.footer" label="Pied de page" icon="pi-angle-down" symmetric allow-folio always-open />
            </div>
          </aside>
          <aside v-else-if="focusedSourceKey === 'liminaire'" class="maquette__aside">
            <h3 class="maquette__aside-title">Éligibilité</h3>
            <LiminaireEligibilite :elig="limElig" />

            <!-- Fin du liminaire : étendre/exclure, migré du jalon (désormais
                 informatif) vers l'aside, tout en bas du flux. -->
            <h3 class="maquette__aside-title maquette__aside-title--spaced">Fin du liminaire</h3>
            <MaquetteLiminaireJalon
                :can-extend="limCanExtend"
                :next-title="limNextTitle"
                :border-shift="limBorderShift"
                @extend="extendLiminaire"
                @exclude="excludeLiminaire"
            />
          </aside>
          <!-- Chapitrage : le modèle exigé (déplacé du main) puis la table des
               styles (rôle · exigé · succession). -->
          <aside v-else-if="focusedSourceKey === 'chapitrage' && focusedSection" class="maquette__aside">
            <h3 class="maquette__aside-title">Modèle exigé</h3>
            <code class="maq-required-sig">{{ requiredModelLabel }}</code>

            <h3 class="maquette__aside-title maquette__aside-title--spaced">Styles &amp; rôles</h3>
            <StyleRolesTable
                :styles="focusedSection.styles"
                :style-roles="styles"
                show-require
                :depth-key="focusedSection.depthKey"
                :zone-key="focusedSection.zone.key"
                :rule-set="focusedSection.ruleSet ?? rules.default"
            />
          </aside>
          <aside v-else class="maquette__aside">
            <p class="maquette__placeholder">Aperçu / réglages secondaires — à câbler.</p>
          </aside>
          </CustomScrollbar>
        </template>
      </AnalyseBlock>
    </div>

    <!-- Dock hors flux, calé sur la seule zone main (2/3) : même structure flex
         2:1 que `.split` au-dessus, l'aside n'est qu'un espaceur pour que
         l'accordéon s'aligne sous main et s'arrête à 2/3. -->
    <div class="maquette__dock">
      <div class="maquette__dock-main">
        <MaquetteAccordeon
            :crans="crans"
            :focused="focused"
            @update:focused="focused = $event"
        >
          <!-- La cellule du vis-à-vis dépend de la source : la maquette montre un
               aperçu de page, le liminaire ses folios physiques, le chapitrage un
               vis-à-vis greeké, les autres un vis-à-vis nu. Toutes au ratio de la
               page effective (previewRatio). L'accordéon rend lui-même les onglets
               d'entrée de série (jalons informatifs), plus de slot #jalon. -->
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
        </MaquetteAccordeon>
      </div>
      <div class="maquette__dock-aside" aria-hidden="true"></div>
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
import { ref, computed, inject, provide, onMounted, onUnmounted, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import MaquetteAccordeon from './MaquetteAccordeon.vue'
import MaquetteSpreadCell from './MaquetteSpreadCell.vue'
import MaquetteFormatFrame from './MaquetteFormatFrame.vue'
import MaquetteLiminaireCell from './MaquetteLiminaireCell.vue'
import MaquetteChapitreCell from './MaquetteChapitreCell.vue'
import MaquetteChapitrage from './MaquetteChapitrage.vue'
import MaquetteLiminaireSpread from './MaquetteLiminaireSpread.vue'
import MaquetteLiminaireJalon from './MaquetteLiminaireJalon.vue'
import AnalyseBlock from '../analyse/AnalyseBlock.vue'
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'
import RunningBandControl from '../config/RunningBandControl.vue'
import PageDiagram from '../config/PageDiagram.vue'
import StyleRolesTable from '../config/StyleRolesTable.vue'
import StyleEditorPanel from '../config/StyleEditorPanel.vue'
import AccordeonControls from '../liminaire/AccordeonControls.vue'
import LiminaireDecoupage from '../liminaire/LiminaireDecoupage.vue'
import LiminaireEligibilite from '../liminaire/LiminaireEligibilite.vue'
import { effectivePage, effectiveMargins } from '../../script/pageFormats'
import { useTypologyConfig } from '../../composables/useTypologyConfig'
import { useLiminaireBornes } from '../../composables/useLiminaireBornes'
import { useLiminaireComposition } from '../../composables/useLiminaireComposition'

const route = useRoute()

// ── État de configuration (partagé avec l'écran config) ─────────────────────
// Même composable que la config : `load` peuple tout (styles, rules, sections,
// styleDefaults, liminaireConfig…), muté en place, `save` persiste d'un coup.
const trame = inject('documentTrame', null)
const documentData = inject('documentData', null)
const documentTitle = inject('documentTitle', null)

const {
  styles, rules, liminaireConfig, styleDefaults, sections, shapesError,
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

// Liste PLATE des vis-à-vis = l'unité de focus. Chaque cran porte de quoi
// retrouver son contenu ET sa série (l'accordéon rend l'onglet d'entrée devant
// le premier cran de chaque série).
const crans = computed(() => {
  const out = []
  series.value.forEach((s, si) => {
    s.spreads.forEach((sp, spi) => {
      out.push({ ...sp, seriesIndex: si, seriesKey: s.key, seriesLabel: s.label, isSeriesStart: spi === 0 })
    })
  })
  return out
})

const focusedCran = computed(() => crans.value[focused.value] ?? null)
const focusedSourceKey = computed(() => focusedCran.value?.sourceKey ?? null)
const focusedTitle = computed(() => focusedCran.value?.seriesLabel ?? '')

// Section de chapitrage focusée (null hors d'un cran chapitrage).
const focusedSection = computed(() => {
  const cran = focusedCran.value
  if (cran?.sourceKey !== 'chapitrage') return null
  return chapSections.value[cran.sectionIndex] ?? null
})

// Modèle exigé du niveau focusé : titre · <rôles requis, ordre typographique> ·
// corps (· tableau), sur le jeu de règles effectif. Rendu dans l'aside (déplacé
// du main d'origine, cf. MaquetteChapitrage).
const REQUIRED_MODEL_ORDER = ['chapeau', 'définition', 'citation', 'renvoi']
const requiredModelLabel = computed(() => {
  const sec = focusedSection.value
  if (!sec) return ''
  const set = sec.ruleSet ?? sec.defaultRuleSet ?? rules.default
  const required = REQUIRED_MODEL_ORDER.filter((r) => set.requiresRoles.includes(r))
  const tokens = ['titre', ...required, 'corps']
  if (set.requiresTable) tokens.push('tableau')
  return tokens.join(' · ')
})

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
// muté en place par MaquetteFormatFrame/RunningBandControl). Nouvel objet à chaque
// édition (spread / clone profond) → les aperçus détectent le changement par référence.
const previewPage = computed(() => effectivePage(fmtPage.value, styleDefaults.pageSize))
const previewMargins = computed(() => ({ ...effectiveMargins(fmtPage.value, styleDefaults.pageMargins) }))
const previewRunningTitles = computed(() => JSON.parse(JSON.stringify(styleDefaults.runningTitles)))

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
</script>

<style scoped>
/* Colonne flex : doc-bar réservée en haut, panneaux au milieu (scroll par
   colonne), dock en bas — tout trois fixes, seul le contenu d'une colonne défile. */
.maquette {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  /* Le haut ne passe plus sous la doc-bar flottante (aligné sur ConfigView). */
  padding-top: calc(var(--bar-size) + 1.25em);
}

/* Prend la hauteur restante ; ne scrolle PAS globalement (chaque colonne porte sa
   propre CustomScrollbar). Padding horizontal seul — le haut vient de .maquette. */
.maquette__panels {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 0 var(--sp-5);
}

/* Le split remplit la hauteur des panneaux et étire ses colonnes (le mode bare
   les alignait en haut) → chaque CustomScrollbar de colonne a un parent borné. */
.maquette__panels :deep(.split) {
  height: 100%;
  margin-bottom: 0;
  align-items: stretch;
}

.maquette__panels :deep(.split-main),
.maquette__panels :deep(.split-right) {
  min-height: 0;
}

/* La CustomScrollbar remplit sa colonne ; son parent bare peut la figer en
   flex:0 0 auto — height:100% (interne) la laisse quand même occuper toute la colonne. */
.maquette__col {
  height: 100%;
}

/* Chaque section de source remplit AU MOINS la colonne (pour que le FolioView
   double-page reçoive une hauteur bornée) et déborde en scroll si besoin. */
.maquette__main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-height: 100%;
}

.maquette__title {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: 600;
}

.maquette__aside {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
}

.maquette__aside-title {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 600;
}

/* Deuxième titre d'une même colonne aside (ex. « Fin du liminaire ») : séparé du
   bloc précédent. */
.maquette__aside-title--spaced {
  margin-top: var(--sp-4);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-border);
}

.maquette__placeholder {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

/* Signature du modèle exigé (aside chapitrage), reprise de l'ancien main. */
.maq-required-sig {
  align-self: flex-start;
  font-family: var(--font-ui);
  font-size: var(--fs-sm);
  padding: 0.15em 0.55em;
  border: 1px solid var(--c-accent);
  border-radius: var(--radius-md);
  background: var(--c-accent-soft, var(--c-surface));
}

.fmt-bands {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

/* Aperçu hybride du liminaire : les contrôles (type/côté + découpage) se révèlent
   au survol, masqués sinon (l'aperçu doit rester lisible au repos). */
.lim-hover {
  position: relative;
  display: flex;
  justify-content: center;
}

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
  background: color-mix(in srgb, var(--c-surface) 94%, transparent);
  backdrop-filter: var(--c-backdrop-filter-blur);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.lim-hover:hover .lim-hover__controls,
.lim-hover:focus-within .lim-hover__controls {
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

/* Dock EN FLUX en bas de la colonne (il réserve sa hauteur, les panneaux prennent
   le reste). Fond transparent. Structure flex 2:1 identique à `.split` : l'accordéon
   ne couvre que la zone main. */
.maquette__dock {
  flex: 0 0 auto;
  display: flex;
  gap: var(--sp-4);
  padding: 0 var(--sp-5) var(--sp-4);
}

.maquette__dock-main {
  flex: 2 1 0;
  min-width: 0;
}

.maquette__dock-aside {
  flex: 1 1 0;
}
</style>
