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
          <!-- Source 1 — l'aperçu au centre, dimensions au-dessus, marges en cadre. -->
          <section v-if="focusedSourceKey === 'maquette'" class="maquette__main">
            <h2 class="maquette__title">Maquette — format de page</h2>
            <MaquetteFormatFrame :page="fmtPage" :style-defaults="styleDefaults" />
          </section>

          <!-- Source 2 — Liminaire : type/côté du vis-à-vis focusé + son découpage. -->
          <section v-else-if="focusedSourceKey === 'liminaire'" class="maquette__main">
            <h2 class="maquette__title">Liminaire</h2>
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

          <!-- Borne de fin du liminaire (jalon focusé). -->
          <section v-else-if="focusedRole === 'liminaire-border'" class="maquette__main">
            <h2 class="maquette__title">Fin du liminaire</h2>
            <UiCallout v-if="limBorderShift > 0" tone="error" title="Aperçu — rien n'est enregistré">
              Liminaire étendu de {{ limBorderShift }} chapitre{{ limBorderShift > 1 ? 's' : '' }}. Seul un
              recalibrage déplace la borne pour de bon — le câblage de persistance viendra ensuite.
            </UiCallout>
            <p class="maquette__placeholder">
              Étends ou réduis le liminaire depuis la borne, dans le dock ci-dessous ; les vis-à-vis se
              recomposent en direct.
            </p>
          </section>

          <!-- Sources restantes / jalons nus — placeholder. -->
          <section v-else class="maquette__main">
            <h2 class="maquette__title">{{ focusedTitle }}</h2>
            <p class="maquette__placeholder">
              Inputs du composant relatif à la source focusée — à câbler.
            </p>
          </section>
        </template>

        <template #aside>
          <aside v-if="focusedSourceKey === 'maquette'" class="maquette__aside">
            <h3 class="maquette__aside-title">En-têtes et pieds</h3>
            <div class="fmt-bands">
              <RunningBandControl :band="styleDefaults.runningTitles.header" label="En-tête" icon="pi-angle-up" always-open />
              <RunningBandControl :band="styleDefaults.runningTitles.footer" label="Pied de page" icon="pi-angle-down" symmetric allow-folio always-open />
            </div>
          </aside>
          <aside
              v-else-if="focusedSourceKey === 'liminaire' || focusedRole === 'liminaire-border'"
              class="maquette__aside"
          >
            <h3 class="maquette__aside-title">Éligibilité</h3>
            <LiminaireEligibilite :elig="limElig" />
          </aside>
          <!-- Chapitrage : la table des styles (rôle · exigé · succession) à droite. -->
          <aside v-else-if="focusedSourceKey === 'chapitrage' && focusedSection" class="maquette__aside">
            <h3 class="maquette__aside-title">Styles &amp; rôles</h3>
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
               vis-à-vis greeké, les autres un vis-à-vis nu. -->
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
            />
            <MaquetteChapitreCell
                v-else-if="cran.sourceKey === 'chapitrage'"
                :depth-key="cran.depthKey"
            />
            <MaquetteSpreadCell v-else />
          </template>

          <!-- Les jalons : la borne de fin du liminaire porte l'action étendre/
               exclure ; les autres restent de simples marqueurs. -->
          <template #jalon="{ cran }">
            <MaquetteLiminaireJalon
                v-if="cran.role === 'liminaire-border'"
                :can-extend="limCanExtend"
                :next-title="limNextTitle"
                :border-shift="limBorderShift"
                @extend="extendLiminaire"
                @exclude="excludeLiminaire"
            />
            <MaquetteJalonCard v-else :label="cran.label" />
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
import MaquetteLiminaireJalon from './MaquetteLiminaireJalon.vue'
import MaquetteJalonCard from './MaquetteJalonCard.vue'
import AnalyseBlock from '../analyse/AnalyseBlock.vue'
import RunningBandControl from '../config/RunningBandControl.vue'
import PageDiagram from '../config/PageDiagram.vue'
import StyleRolesTable from '../config/StyleRolesTable.vue'
import StyleEditorPanel from '../config/StyleEditorPanel.vue'
import AccordeonControls from '../liminaire/AccordeonControls.vue'
import LiminaireDecoupage from '../liminaire/LiminaireDecoupage.vue'
import LiminaireEligibilite from '../liminaire/LiminaireEligibilite.vue'
import UiCallout from '../ui/atoms/UiCallout.vue'
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

// ── Crans : maquette · [vis-à-vis liminaire] · [niveaux de chapitrage], jalons
// intercalés. Liminaire et chapitrage portent AUTANT de crans que de vis-à-vis /
// de niveaux (dynamique). Chaque cran mémorise de quoi retrouver son contenu.
const crans = computed(() => {
  const out = []
  const push = (sourceKey, label, extra = {}) => out.push({ kind: 'spread', sourceKey, label, ...extra })
  const jalon = (label) => out.push({ kind: 'jalon', label })

  push('maquette', 'Maquette')
  jalon('Maquette → Liminaire')

  const sp = limSpreads.value
  if (sp.length) sp.forEach((_, i) => push('liminaire', 'Liminaire', { spreadIndex: i }))
  else push('liminaire', 'Liminaire', { spreadIndex: 0 })

  // Ce jalon EST la borne de fin du liminaire : il porte l'action étendre/exclure.
  const chs = chapSections.value
  out.push({ kind: 'jalon', label: `Liminaire → ${chs[0]?.zone.label ?? 'Chapitrage'}`, role: 'liminaire-border' })

  chs.forEach((sec, i) => {
    if (i > 0) jalon(`${chs[i - 1].zone.label} → ${sec.zone.label}`)
    push('chapitrage', sec.zone.label, { sectionIndex: i, depthKey: sec.depthKey })
  })
  return out
})

const focusedCran = computed(() => crans.value[focused.value] ?? null)
// Clé de la source focusée (null sur un jalon → panneau placeholder).
const focusedSourceKey = computed(() => focusedCran.value?.sourceKey ?? null)
// Rôle du cran focusé (les jalons peuvent en porter un, ex. la borne liminaire).
const focusedRole = computed(() => focusedCran.value?.role ?? null)
const focusedTitle = computed(() => {
  const cran = focusedCran.value
  if (!cran) return ''
  return cran.kind === 'jalon' ? `Jalon · ${cran.label}` : cran.label
})

// Section de chapitrage focusée (null hors d'un cran chapitrage).
const focusedSection = computed(() => {
  const cran = focusedCran.value
  if (cran?.sourceKey !== 'chapitrage') return null
  return chapSections.value[cran.sectionIndex] ?? null
})

// Étendre/exclure recompose les vis-à-vis liminaire (donc les crans) : on garde le
// focus SUR la borne pour que la scène reste centrée sur le geste en cours.
function focusBorderJalon() {
  const i = crans.value.findIndex((c) => c.role === 'liminaire-border')
  if (i >= 0) focused.value = i
}
function extendLiminaire() {
  limBorderShift.value++
  focusBorderJalon()
}
function excludeLiminaire() {
  if (limBorderShift.value > 0) limBorderShift.value--
  focusBorderJalon()
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
.maquette {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.maquette__panels {
  height: 100%;
  overflow: auto;
  padding: var(--sp-5);
  /* Réserve la place du dock (hors flux) pour que rien ne se cache dessous. */
  padding-bottom: 16em;
}

.maquette__main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
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

.maquette__placeholder {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.fmt-bands {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

/* Aperçu de page dans la cellule d'accordéon : borné à la largeur d'un vis-à-vis. */
.maq-format-cell {
  width: min(100%, 22em);
  margin: 0;
}

/* Dock hors du flux, collé au bord bas. Fond transparent (les folios flottent au
   ras des panneaux). Structure flex 2:1 identique à `.split` : l'accordéon ne
   couvre que la zone main. */
.maquette__dock {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: var(--sp-4);
  padding: 0 var(--sp-5) var(--sp-4);
  pointer-events: none;
}

.maquette__dock-main {
  flex: 2 1 0;
  min-width: 0;
  pointer-events: auto;
}

.maquette__dock-aside {
  flex: 1 1 0;
}
</style>
