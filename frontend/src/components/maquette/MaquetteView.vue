<template>
  <!-- Écran Maquette. Deux colonnes (2/3 main · 1/3 aside) qui se remplissent des
       inputs de la SOURCE focusée dans l'accordéon ; en bas, hors du flux et collé
       au bord, un dock accordéon (pellicule de crans).
       ITÉRATION 3 : source 1 (« config › maquette ») + source 2 (Liminaire, en
       accordéon UNIFIÉ — ses vis-à-vis sont des crans du dock, son découpage/
       éligibilité remplissent main/aside). Sources 3-4 encore placeholder.
       Câblage VISUEL : rien n'est persisté (`fmt` local ; `liminaireConfig` chargé
       mais pas sauvé). -->
  <div class="maquette">
    <div class="maquette__panels">
      <AnalyseBlock aside="right" bare>
        <template #main>
          <!-- Source 1 — l'aperçu au centre, dimensions au-dessus, marges en cadre. -->
          <section v-if="focusedSourceKey === 'maquette'" class="maquette__main">
            <h2 class="maquette__title">Maquette — format de page</h2>
            <MaquetteFormatFrame :page="fmtPage" :style-defaults="fmt" />
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

          <!-- Sources 3-4 — placeholder. -->
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
              <RunningBandControl :band="fmt.runningTitles.header" label="En-tête" icon="pi-angle-up" always-open />
              <RunningBandControl :band="fmt.runningTitles.footer" label="Pied de page" icon="pi-angle-down" symmetric allow-folio always-open />
            </div>
          </aside>
          <aside v-else-if="focusedSourceKey === 'liminaire'" class="maquette__aside">
            <h3 class="maquette__aside-title">Éligibilité</h3>
            <LiminaireEligibilite :elig="limElig" />
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
               aperçu de page, le liminaire ses folios physiques, les autres un
               vis-à-vis nu. -->
          <template #spread="{ cran }">
            <PageDiagram
                v-if="cran.sourceKey === 'maquette'"
                class="maq-format-cell"
                :page-size="fmtEffective.pageSize"
                :margins="fmtEffective.margins"
                :running-titles="fmt.runningTitles"
            />
            <MaquetteLiminaireCell
                v-else-if="cran.sourceKey === 'liminaire' && limSpreads[cran.spreadIndex]"
                :spread="limSpreads[cran.spreadIndex]"
                :types="limTypes"
                :suggestions="limSuggestions"
            />
            <MaquetteSpreadCell v-else />
          </template>
        </MaquetteAccordeon>
      </div>
      <div class="maquette__dock-aside" aria-hidden="true"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import MaquetteAccordeon from './MaquetteAccordeon.vue'
import MaquetteSpreadCell from './MaquetteSpreadCell.vue'
import MaquetteFormatFrame from './MaquetteFormatFrame.vue'
import MaquetteLiminaireCell from './MaquetteLiminaireCell.vue'
import AnalyseBlock from '../analyse/AnalyseBlock.vue'
import RunningBandControl from '../config/RunningBandControl.vue'
import PageDiagram from '../config/PageDiagram.vue'
import AccordeonControls from '../liminaire/AccordeonControls.vue'
import LiminaireDecoupage from '../liminaire/LiminaireDecoupage.vue'
import LiminaireEligibilite from '../liminaire/LiminaireEligibilite.vue'
import { effectivePage, effectiveMargins } from '../../script/pageFormats'
import { useTypologyConfig } from '../../composables/useTypologyConfig'
import { useLiminaireBornes } from '../../composables/useLiminaireBornes'
import { useLiminaireComposition } from '../../composables/useLiminaireComposition'

const route = useRoute()

// ── Source 2 : Liminaire ────────────────────────────────────────────────────
// Même sources de données que la config (liminaireConfig chargé/muté en place,
// pages recomposées à la volée). Persistance en dernier : on charge mais ne sauve
// pas encore.
const trame = inject('documentTrame', null)
const documentData = inject('documentData', null)
const documentTitle = inject('documentTitle', null)

const { liminaireConfig, load } = useTypologyConfig()
onMounted(() => { if (route.params.id) load(route.params.id) })

const { liminairePages } = useLiminaireBornes(trame, documentData, liminaireConfig)

const focused = ref(0)

const {
  spreads: limSpreads, types: limTypes, suggestions: limSuggestions,
  sides: limSides, expectedSides: limExpectedSides, conflicts: limConflicts,
  elig: limElig, focusedPages: limFocusedPages, emptyLabel: limEmptyLabel,
  onSetType: limSetType, onSetSide: limSetSide,
} = useLiminaireComposition({
  pages: () => liminairePages.value,
  config: () => liminaireConfig,
  title: () => documentTitle?.value ?? '',
  focused: () => limFocused.value,
})

// ── Crans : maquette · [vis-à-vis liminaire] · chap1 · chap2, jalons intercalés.
// Le liminaire porte AUTANT de crans que de vis-à-vis (dynamique). Chaque cran
// liminaire mémorise son index de planche pour retrouver son contenu.
const crans = computed(() => {
  const out = []
  const push = (sourceKey, label, extra = {}) => out.push({ kind: 'spread', sourceKey, label, ...extra })
  const jalon = (label) => out.push({ kind: 'jalon', label })

  push('maquette', 'Maquette')
  jalon('Maquette → Liminaire')

  const sp = limSpreads.value
  if (sp.length) sp.forEach((_, i) => push('liminaire', 'Liminaire', { spreadIndex: i }))
  else push('liminaire', 'Liminaire', { spreadIndex: 0 })
  jalon('Liminaire → Chapitrage n1')

  push('chap1', 'Chapitrage n1')
  jalon('Chapitrage n1 → Chapitrage n2')
  push('chap2', 'Chapitrage n2')
  return out
})

const focusedCran = computed(() => crans.value[focused.value] ?? null)
// Clé de la source focusée (null sur un jalon → panneau placeholder).
const focusedSourceKey = computed(() => focusedCran.value?.sourceKey ?? null)
const focusedTitle = computed(() => {
  const cran = focusedCran.value
  if (!cran) return ''
  return cran.kind === 'jalon' ? `Jalon · ${cran.label}` : cran.label
})

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

// styleDefaults LOCAL (même forme que useTypologyConfig) — muté en place par
// MaquetteFormatFrame/RunningBandControl, lié à l'aperçu. Non persisté.
const fmt = reactive({
  hyphenation: { global: false },
  pageSize: null,
  pageMargins: null,
  runningTitles: {
    header: { enabled: false, recto: 'chapitre', verso: 'titre', heightCm: null, justification: 'regard' },
    footer: { enabled: false, recto: 'folio', verso: 'folio', heightCm: null, justification: 'centre' },
  },
})

// Format EFFECTIF = relevé .odt + surcharges en cours (mergés), pour l'aperçu.
const fmtEffective = computed(() => ({
  pageSize: effectivePage(fmtPage.value, fmt.pageSize),
  margins: effectiveMargins(fmtPage.value, fmt.pageMargins),
}))
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
