<template>
  <!-- Écran Maquette. Deux colonnes (2/3 main · 1/3 aside) qui se remplissent des
       inputs de la SOURCE focusée dans l'accordéon ; en bas, hors du flux et collé
       au bord, un dock accordéon (pellicule de crans). ITÉRATION 2 : source 1
       (« config › maquette ») câblée pour de vrai (format + en-tête), sources 2-4
       encore en placeholder. Câblage VISUEL : `fmt` est local, lié à l'aperçu,
       PAS persisté (pas de save pour l'instant). -->
  <div class="maquette">
    <div class="maquette__panels">
      <AnalyseBlock aside="right" bare>
        <template #main>
          <!-- Source 1 — l'aperçu au centre, dimensions au-dessus, marges en cadre
               autour (cf. MaquetteFormatFrame). Les en-têtes/pieds sont dans l'aside. -->
          <section v-if="focusedSourceKey === 'maquette'" class="maquette__main">
            <h2 class="maquette__title">Maquette — format de page</h2>
            <MaquetteFormatFrame :page="fmtPage" :style-defaults="fmt" />
          </section>

          <!-- Sources 2-4 — placeholder. -->
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
               vrai aperçu de page (bordures + en-tête), les autres un vis-à-vis nu. -->
          <template #spread="{ cran }">
            <PageDiagram
                v-if="cran.sourceKey === 'maquette'"
                class="maq-format-cell"
                :page-size="fmtEffective.pageSize"
                :margins="fmtEffective.margins"
                :running-titles="fmt.runningTitles"
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
import { ref, reactive, computed, inject } from 'vue'
import MaquetteAccordeon from './MaquetteAccordeon.vue'
import MaquetteSpreadCell from './MaquetteSpreadCell.vue'
import AnalyseBlock from '../analyse/AnalyseBlock.vue'
import MaquetteFormatFrame from './MaquetteFormatFrame.vue'
import RunningBandControl from '../config/RunningBandControl.vue'
import PageDiagram from '../config/PageDiagram.vue'
import { effectivePage, effectiveMargins } from '../../script/pageFormats'

// Chaque source = une série de vis-à-vis ; `spreads` en fixe le nombre. Source 1
// câblée (format) ; 2-4 encore factices.
const sources = [
  { key: 'maquette', label: 'Maquette', spreads: 1 },
  { key: 'liminaire', label: 'Liminaire', spreads: 3 },
  { key: 'chap1', label: 'Chapitrage n1', spreads: 1 },
  { key: 'chap2', label: 'Chapitrage n2', spreads: 1 },
]

// Liste PLATE des crans : les vis-à-vis d'une source, puis un jalon avant la
// suivante (donc n-1 jalons pour n sources).
const crans = computed(() => {
  const out = []
  sources.forEach((src, si) => {
    for (let s = 0; s < src.spreads; s++) {
      out.push({ kind: 'spread', sourceKey: src.key, label: src.label })
    }
    if (si < sources.length - 1) {
      out.push({ kind: 'jalon', label: `${src.label} → ${sources[si + 1].label}` })
    }
  })
  return out
})

const focused = ref(0)

const focusedCran = computed(() => crans.value[focused.value] ?? null)
// Clé de la source focusée (null sur un jalon → panneau placeholder).
const focusedSourceKey = computed(() => focusedCran.value?.sourceKey ?? null)
const focusedTitle = computed(() => {
  const cran = focusedCran.value
  if (!cran) return ''
  return cran.kind === 'jalon' ? `Jalon · ${cran.label}` : cran.label
})

// ── Source 1 : format de page ──────────────────────────────────────────────
// Relevé .odt brut (fourni par DocumentLayout), point de départ de l'aperçu.
const documentPageOdt = inject('documentPageOdt', null)
const fmtPage = computed(() => documentPageOdt?.value ?? null)

// styleDefaults LOCAL (même forme que useTypologyConfig) — muté en place par
// PageFormatSection/RunningBandControl, lié à l'aperçu. Non persisté (câblage
// visuel d'abord).
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
