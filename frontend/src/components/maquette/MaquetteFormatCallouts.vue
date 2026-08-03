<template>
  <!-- Contrôles de FORMAT posés SUR l'aperçu (écran Maquette). Deux familles :
       - une COLONNE unique à droite du folio (champs nus, sans cadre) : dimensions,
         blancs de marge, hauteurs, fonds — chaque ligne reliée à sa zone par UN
         trait droit qui passe par-dessus le folio (rail vertical + fuyantes) ;
       - les SELECTS de contenu (titre courant / folio), posés à même la zone grisée
         de chaque bande, là où le contenu s'imprimera — avec leur justification à côté.
       `styleDefaults` est muté en place. Géométrie de planche via `geometry`. -->
  <div ref="rootRef" class="fc">
    <!-- Rail + fuyantes, au-dessus du folio (l'SVG couvre toute la scène). -->
    <svg class="fc__wires" :width="box.w" :height="box.h" aria-hidden="true">
      <line
          v-if="rail" class="fc-rail"
          :x1="rail.x" :y1="rail.y1" :x2="rail.x" :y2="rail.y2"
      />
      <g v-for="l in leaders" :key="l.key" class="fc-lead">
        <line :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" />
        <circle :cx="l.x2" :cy="l.y2" r="2.2" />
      </g>
    </svg>

    <!-- ── Selects de contenu, posés sur les bandes grisées ─────────────────── -->
    <template v-if="header.enabled">
      <div v-if="a['header-recto-box']" class="fc-band" :style="bandStyle(a['header-recto-box'])">
        <BareSelect v-model="header.recto" :options="HEADER_OPTIONS" />
      </div>
      <div v-if="a['header-verso-box']" class="fc-band" :style="bandStyle(a['header-verso-box'])">
        <BareSelect v-model="header.verso" :options="HEADER_OPTIONS" />
        <BareSelect v-model="header.justification" :options="JUSTIF_OPTIONS" muted />
      </div>
    </template>
    <template v-if="footer.enabled">
      <div v-if="a['footer-recto-box']" class="fc-band" :style="bandStyle(a['footer-recto-box'])">
        <BareSelect v-model="footerContent" :options="FOOTER_OPTIONS" />
      </div>
      <div v-if="a['footer-verso-box']" class="fc-band" :style="bandStyle(a['footer-verso-box'])">
        <BareSelect v-model="footerContent" :options="FOOTER_OPTIONS" />
        <BareSelect v-model="footer.justification" :options="JUSTIF_OPTIONS" muted />
      </div>
    </template>

    <!-- ── Colonne unique de champs nus, à droite du folio ──────────────────── -->
    <div v-if="frame" class="fc-col" :style="{ left: `${frame.railX}px`, top: `${frame.top}px` }">
      <div class="fc-row" :ref="(el) => setRow('dimensions', el)">
        <span class="fc-row__label">Dimensions</span>
        <BareSelect v-model="selectedKey" :options="DIM_OPTIONS" />
      </div>
      <div class="fc-row" :ref="(el) => setRow('unit', el)">
        <span class="fc-row__label">Unité</span>
        <BareSelect v-model="unit" :options="UNIT_OPTIONS" muted />
      </div>
      <template v-if="isCustom">
        <div class="fc-row" :ref="(el) => setRow('dim-w', el)">
          <span class="fc-row__label">Largeur</span>
          <NumInput :value="toUnit(effective && effective.widthCm, unit)" :step="step" :unit="unit"
                    @input="setDimension('widthCm', $event)" />
        </div>
        <div class="fc-row" :ref="(el) => setRow('dim-h', el)">
          <span class="fc-row__label">Hauteur</span>
          <NumInput :value="toUnit(effective && effective.heightCm, unit)" :step="step" :unit="unit"
                    @input="setDimension('heightCm', $event)" />
        </div>
      </template>

      <label class="fc-row fc-row--toggle" :ref="(el) => setRow('h-enable', el)">
        <span class="fc-row__label"><input type="checkbox" v-model="header.enabled" /> En-tête</span>
      </label>
      <div class="fc-row" :ref="(el) => setRow('blanc-tete', el)">
        <span class="fc-row__label">Blanc de tête</span>
        <NumInput :value="toUnit(marginsView.topCm, unit)" :step="step" :unit="unit"
                  @input="setMargin('topCm', $event)" />
      </div>
      <div v-if="header.enabled" class="fc-row" :ref="(el) => setRow('header-height', el)">
        <span class="fc-row__label">Hauteur en-tête</span>
        <NumInput :value="toUnit(header.heightCm, unit)" :step="step" :unit="unit" placeholder="auto"
                  @input="setBandHeight(header, $event)" />
      </div>

      <label class="fc-row fc-row--toggle" :ref="(el) => setRow('f-enable', el)">
        <span class="fc-row__label"><input type="checkbox" v-model="footer.enabled" /> Pied de page</span>
      </label>
      <div class="fc-row" :ref="(el) => setRow('blanc-pied', el)">
        <span class="fc-row__label">Blanc de pied</span>
        <NumInput :value="toUnit(marginsView.bottomCm, unit)" :step="step" :unit="unit"
                  @input="setMargin('bottomCm', $event)" />
      </div>
      <div v-if="footer.enabled" class="fc-row" :ref="(el) => setRow('footer-height', el)">
        <span class="fc-row__label">Hauteur pied</span>
        <NumInput :value="toUnit(footer.heightCm, unit)" :step="step" :unit="unit" placeholder="auto"
                  @input="setBandHeight(footer, $event)" />
      </div>

      <div class="fc-row" :ref="(el) => setRow('petit-fond', el)">
        <span class="fc-row__label">Petit fond</span>
        <NumInput :value="toUnit(marginsView.innerCm, unit)" :step="step" :unit="unit"
                  @input="setMargin('innerCm', $event)" />
      </div>
      <div class="fc-row" :ref="(el) => setRow('grand-fond', el)">
        <span class="fc-row__label">Grand fond</span>
        <NumInput :value="toUnit(marginsView.outerCm, unit)" :step="step" :unit="unit"
                  @input="setMargin('outerCm', $event)" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BareSelect from './BareSelect.vue'
import NumInput from './NumInput.vue'
import { buildFormatAnchors } from '../../script/formatAnchors'
import {
  PAGE_FORMATS, UNITS, effectiveMargins, effectivePage, matchFormat,
  toUnit, fromUnit, unitStep,
} from '../../script/pageFormats'

const props = defineProps({
  page: { type: Object, default: null },
  styleDefaults: { type: Object, required: true },
  // { pages: [{left,top,width,height}] } émis par FolioView.
  geometry: { type: Object, default: null },
})

const header = computed(() => props.styleDefaults.runningTitles.header)
const footer = computed(() => props.styleDefaults.runningTitles.footer)

// Pied symétrique : un seul choix, écrit recto ET verso.
const footerContent = computed({
  get: () => footer.value.recto,
  set: (v) => { footer.value.recto = v; footer.value.verso = v },
})

const HEADER_OPTIONS = [
  { value: 'titre', label: 'Titre du livre' },
  { value: 'chapitre', label: 'Nom du chapitre' },
  { value: 'aucun', label: 'Rien' },
]
const FOOTER_OPTIONS = [
  { value: 'titre', label: 'Titre du livre' },
  { value: 'chapitre', label: 'Nom du chapitre' },
  { value: 'folio', label: 'Numéro de page' },
  { value: 'aucun', label: 'Rien' },
]
const JUSTIF_OPTIONS = [
  { value: 'centre', label: 'Centré' },
  { value: 'regard', label: 'En regard' },
]
const DIM_OPTIONS = [
  { value: '', label: 'Original (.odt)' },
  ...PAGE_FORMATS.map((f) => ({ value: f.key, label: f.label })),
  { value: 'custom', label: 'Personnaliser…' },
]
const UNIT_OPTIONS = UNITS.map((u) => ({ value: u.key, label: u.label }))

// ── Unité d'affichage (le modèle reste en cm) ────────────────────────────────
const unit = ref('cm')
const step = computed(() => unitStep(unit.value))

const effective = computed(() => effectivePage(props.page, props.styleDefaults.pageSize))
const marginsView = computed(() => effectiveMargins(props.page, props.styleDefaults.pageMargins))

// ── Sélecteur de format (stocke des DIMENSIONS, pas un nom) ───────────────────
const selectedKey = computed({
  get() {
    const ps = props.styleDefaults.pageSize
    if (!ps) return ''
    return matchFormat(ps.widthCm, ps.heightCm)?.key ?? 'custom'
  },
  set(key) {
    if (key === '') {
      props.styleDefaults.pageSize = null
    } else if (key === 'custom') {
      const base = effective.value ?? { widthCm: 14.8, heightCm: 21 }
      props.styleDefaults.pageSize = { widthCm: base.widthCm, heightCm: base.heightCm }
    } else {
      const f = PAGE_FORMATS.find((x) => x.key === key)
      if (f) props.styleDefaults.pageSize = { widthCm: f.widthCm, heightCm: f.heightCm }
    }
  },
})
const isCustom = computed(() => selectedKey.value === 'custom')

function setDimension(key, raw) {
  const cm = fromUnit(raw, unit.value)
  if (cm == null || cm <= 0) return
  if (!props.styleDefaults.pageSize) {
    const base = effective.value ?? { widthCm: 14.8, heightCm: 21 }
    props.styleDefaults.pageSize = { widthCm: base.widthCm, heightCm: base.heightCm }
  }
  props.styleDefaults.pageSize[key] = cm
}

// Éditer une marge matérialise la surcharge (copie des marges effectives) au besoin.
function setMargin(key, raw) {
  const cm = fromUnit(raw, unit.value)
  if (cm == null || cm < 0) return
  if (!props.styleDefaults.pageMargins) {
    props.styleDefaults.pageMargins = { ...effectiveMargins(props.page, null) }
  }
  props.styleDefaults.pageMargins[key] = cm
}

function setBandHeight(band, raw) {
  const s = String(raw).trim()
  if (s === '') { band.heightCm = null; return }
  const cm = fromUnit(raw, unit.value)
  band.heightCm = cm != null && cm > 0 ? cm : null
}

// ── Géométrie : origine (rect de cet overlay), ancres, rail, fuyantes ─────────
const rootRef = ref(null)
const origin = ref({ left: 0, top: 0 })
const box = ref({ w: 0, h: 0 })

const a = computed(() =>
  buildFormatAnchors({
    pages: props.geometry?.pages ?? null,
    pageSize: effective.value,
    margins: marginsView.value,
    runningTitles: props.styleDefaults.runningTitles,
    origin: origin.value,
  }),
)

// Rail : juste à droite du verso (page de droite), coiffant la hauteur du folio.
const GAP = 22
const frame = computed(() => {
  const g = props.geometry?.pages
  if (!g || g.length < 2) return null
  const o = origin.value
  const verso = g[1]
  return { railX: verso.left - o.left + verso.width + GAP, top: g[0].top - o.top }
})

// Une boîte de bande → position centrée pour le groupe de selects posé dessus.
function bandStyle(bx) {
  return { left: `${bx.x + bx.w / 2}px`, top: `${bx.y + bx.h / 2}px` }
}

// Lignes de la colonne qui portent une fuyante : clé de ligne → clé d'ancre.
const LEADS = {
  'blanc-tete': 'blanc-tete',
  'header-height': 'header-height',
  'blanc-pied': 'blanc-pied',
  'footer-height': 'footer-height',
  'petit-fond': 'petit-fond',
  'grand-fond': 'grand-fond',
}

const rowEls = new Map()
function setRow(key, el) {
  if (el) rowEls.set(key, el)
  else rowEls.delete(key)
}

const leaders = ref([])
const rail = ref(null)

// Deux temps : poser l'origine (→ ancres + position de la colonne recalculées),
// puis, le DOM à jour, mesurer le centre de chaque ligne pour tracer les fuyantes.
async function measure() {
  const root = rootRef.value
  if (!root) return
  const r = root.getBoundingClientRect()
  origin.value = { left: r.left, top: r.top }
  box.value = { w: r.width, h: r.height }

  await nextTick()
  const anchors = a.value
  const railX = frame.value?.railX ?? 0
  const centers = []
  const next = []
  for (const [key, el] of rowEls) {
    if (!el) continue
    const rr = el.getBoundingClientRect()
    const cy = rr.top - origin.value.top + rr.height / 2
    centers.push(cy)
    const anc = anchors[LEADS[key]]
    if (anc) next.push({ key, x1: railX, y1: cy, x2: anc.x, y2: anc.y })
  }
  leaders.value = next
  rail.value = centers.length ? { x: railX, y1: Math.min(...centers), y2: Math.max(...centers) } : null
}

let ro = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(rootRef.value)
})
onBeforeUnmount(() => ro?.disconnect())

// La géométrie change (repagination/échelle/molette) OU un réglage bouge une zone
// (marge, hauteur de bande, format) → on remesure : la colonne peut avoir bougé et
// les ancres avec.
watch(() => props.geometry, measure)
watch(() => props.styleDefaults, measure, { deep: true })
</script>

<style scoped>
.fc {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Au-dessus de l'iframe du FolioView (z-index 1 en double-page) : sinon les
     selects posés sur les pages et les fuyantes qui recouvrent le folio passent
     DESSOUS. Reste sous le sommaire flottant (160) et les modales (200). */
  z-index: 3;
}

/* Rail + fuyantes : au-dessus du folio, non interactifs. */
.fc__wires {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
}

.fc-rail {
  stroke: var(--c-border);
  stroke-width: 1;
}

.fc-lead line {
  stroke: var(--c-ink2);
  stroke-width: 1;
  opacity: var(--op-muted);
}

.fc-lead circle {
  fill: var(--c-ink2);
  opacity: var(--op-muted);
}

/* Groupe de selects posé sur une bande grisée : centré sur la bande. */
.fc-band {
  position: absolute;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
  pointer-events: auto;
}

/* Colonne unique de champs nus, à droite du folio. */
.fc-col {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: auto;
}

.fc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  min-width: 13em;
  font-size: var(--fs-sm);
}

.fc-row__label {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-ink2);
  white-space: nowrap;
}

.fc-row--toggle {
  margin-top: var(--sp-2);
  cursor: pointer;
  font-weight: 600;
}

.fc-row--toggle .fc-row__label {
  color: var(--c-ink);
}
</style>
