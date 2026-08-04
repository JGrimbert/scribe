<template>
  <!-- Contrôles de FORMAT posés SUR l'aperçu (écran Maquette). Trois zones :
       - deux GROUPES à droite du folio (haut = en-tête, bas = pied), champs nus
         reliés à leur zone par un trait droit (rail + fuyantes, par-dessus le folio) ;
       - un bloc SOUS la planche : ligne dimensions (format + X/Y + unité) et ligne
         des fonds (petit/grand), reliés aux bas de page ;
       - les SELECTS de contenu (titre courant / folio) posés à même la bande grisée.
       `styleDefaults` muté en place. Géométrie de planche via `geometry`. -->
  <div ref="rootRef" class="fc">
    <!-- Zones surlignables : survolées (ici, ou via le label du contrôle) elles se
         marquent. `page` en premier (dessous) : les zones précises la couvrent. -->
    <div
        v-for="z in zoneList" :key="z.id"
        class="fc-zone" :class="{ 'fc-zone--on': hovered === z.key }"
        :style="rectStyle(z.rect)"
        @mouseenter="hovered = z.key" @mouseleave="hovered = null"
    />

    <svg class="fc__wires" :width="box.w" :height="box.h" aria-hidden="true">
      <line v-if="rail" class="fc-rail" :x1="rail.x" :y1="rail.y1" :x2="rail.x" :y2="rail.y2" />
      <g v-for="l in leaders" :key="l.key" class="fc-lead" :class="{ 'fc-lead--on': hovered === l.key }">
        <line :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" />
        <circle :cx="l.x2" :cy="l.y2" r="2.2" />
      </g>
    </svg>

    <!-- ── Selects de contenu, posés sur les bandes grisées ─────────────────── -->
    <template v-if="header.enabled">
      <div v-if="anchors['header-recto-box']" class="fc-band" :style="bandStyle(anchors['header-recto-box'])"
           @mouseenter="hovered = 'header'" @mouseleave="hovered = null">
        <BareSelect v-model="header.recto" :options="HEADER_OPTIONS" />
      </div>
      <div v-if="anchors['header-verso-box']" class="fc-band" :style="bandStyle(anchors['header-verso-box'])"
           @mouseenter="hovered = 'header'" @mouseleave="hovered = null">
        <BareSelect v-model="header.verso" :options="HEADER_OPTIONS" />
      </div>
    </template>
    <template v-if="footer.enabled">
      <!-- Contenu du pied : quand c'est le folio, son STYLE de numérotation se
           choisit à côté (1 / I / a) — réglage global au livre, donc le même select
           des deux côtés de la planche. -->
      <div v-if="anchors['footer-recto-box']" class="fc-band" :style="bandStyle(anchors['footer-recto-box'])"
           @mouseenter="hovered = 'footer'" @mouseleave="hovered = null">
        <BareSelect v-model="footerContent" :options="FOOTER_OPTIONS" />
        <BareSelect v-if="footerContent === 'folio'" v-model="folioFormat" :options="FOLIO_FORMAT_OPTIONS" muted />
      </div>
      <div v-if="anchors['footer-verso-box']" class="fc-band" :style="bandStyle(anchors['footer-verso-box'])"
           @mouseenter="hovered = 'footer'" @mouseleave="hovered = null">
        <BareSelect v-model="footerContent" :options="FOOTER_OPTIONS" />
        <BareSelect v-if="footerContent === 'folio'" v-model="folioFormat" :options="FOLIO_FORMAT_OPTIONS" muted />
      </div>
    </template>

    <template v-if="geo">
      <!-- ── Groupe HAUT (en-tête), ferré au sommet du folio ────────────────── -->
      <div class="fc-grp" :style="{ left: `${geo.railX}px`, top: `${geo.top}px` }">
        <div class="fc-row" :ref="(el) => setRow('blanc-tete', el)"
             @mouseenter="hovered = 'blanc-tete'" @mouseleave="hovered = null">
          <span class="fc-row__label">Blanc de tête</span>
          <NumInput :value="toUnit(marginsView.topCm, unit)" :step="step" :unit="unit"
                    @input="setMargin('topCm', $event)" />
        </div>
        <label class="fc-row" :ref="(el) => setRow('header-height', el)"
               @mouseenter="hovered = 'header'" @mouseleave="hovered = null">
          <span class="fc-row__label">
            <input type="checkbox" v-model="header.enabled" /> Hauteur en-tête
          </span>
          <NumInput :value="toUnit(header.heightCm, unit)" :step="step" :unit="unit" placeholder="auto"
                    :disabled="!header.enabled" @input="setBandHeight(header, $event)" />
        </label>
        <!-- Placement du contenu dans la bande : ferré à droite sous la hauteur,
             sans intitulé (le libellé de l'option se suffit). -->
        <div class="fc-row fc-row--sub"
             @mouseenter="hovered = 'header'" @mouseleave="hovered = null">
          <BareSelect v-model="header.justification" :options="JUSTIF_OPTIONS" muted :disabled="!header.enabled" />
        </div>
      </div>

      <!-- ── Dimensions : au milieu à droite, centré verticalement. Sans zone
           surlignable : elles désignent la planche entière, que rien n'a besoin
           de montrer (on la voit déjà) — le survol la barbouillerait pour rien. -->
      <div class="fc-dims" :style="{ left: `${geo.railX}px`, top: `${geo.midY}px` }">
        <BareSelect v-model="selectedKey" :options="DIM_OPTIONS" />
        <span class="fc-dims__wh">
          <NumInput :value="toUnit(effective && effective.widthCm, unit)" :step="step" unit=""
                    @input="setDimension('widthCm', $event)" />
          <span class="fc-times">×</span>
          <NumInput :value="toUnit(effective && effective.heightCm, unit)" :step="step" unit=""
                    @input="setDimension('heightCm', $event)" />
          <BareSelect v-model="unit" :options="UNIT_OPTIONS" muted />
        </span>
      </div>

      <!-- ── Groupe BAS (pied), ferré au bas du folio. Ordre inversé (miroir du
           groupe haut) : placement, Hauteur pied, puis Blanc de pied au ras du
           bas. ──────────────────────────────────────────────────────────────── -->
      <div class="fc-grp fc-grp--bottom" :style="{ left: `${geo.railX}px`, top: `${geo.bottom}px` }">
        <div class="fc-row fc-row--sub"
             @mouseenter="hovered = 'footer'" @mouseleave="hovered = null">
          <BareSelect v-model="footer.justification" :options="JUSTIF_OPTIONS" muted :disabled="!footer.enabled" />
        </div>
        <label class="fc-row" :ref="(el) => setRow('footer-height', el)"
               @mouseenter="hovered = 'footer'" @mouseleave="hovered = null">
          <span class="fc-row__label">
            <input type="checkbox" v-model="footer.enabled" /> Hauteur pied
          </span>
          <NumInput :value="toUnit(footer.heightCm, unit)" :step="step" :unit="unit" placeholder="auto"
                    :disabled="!footer.enabled" @input="setBandHeight(footer, $event)" />
        </label>
        <div class="fc-row" :ref="(el) => setRow('blanc-pied', el)"
             @mouseenter="hovered = 'blanc-pied'" @mouseleave="hovered = null">
          <span class="fc-row__label">Blanc de pied</span>
          <NumInput :value="toUnit(marginsView.bottomCm, unit)" :step="step" :unit="unit"
                    @input="setMargin('bottomCm', $event)" />
        </div>
      </div>

      <!-- ── Fonds : label POSÉ sur chaque page, entre Hauteur en-tête et les
           dimensions, avec un trait vers son liséré de marge. Petit fond sur la
           page de gauche, grand fond sur la droite. ─────────────────────────── -->
      <div class="fc-onpage" :style="{ left: `${geo.rectoCenterX}px`, top: `${geo.fondY}px` }"
           :ref="(el) => setRow('petit-fond', el)"
           @mouseenter="hovered = 'petit-fond'" @mouseleave="hovered = null">
        <span class="fc-row__label">Petit fond</span>
        <NumInput :value="toUnit(marginsView.innerCm, unit)" :step="step" :unit="unit"
                  @input="setMargin('innerCm', $event)" />
      </div>
      <div class="fc-onpage" :style="{ left: `${geo.versoCenterX}px`, top: `${geo.fondY}px` }"
           :ref="(el) => setRow('grand-fond', el)"
           @mouseenter="hovered = 'grand-fond'" @mouseleave="hovered = null">
        <span class="fc-row__label">Grand fond</span>
        <NumInput :value="toUnit(marginsView.outerCm, unit)" :step="step" :unit="unit"
                  @input="setMargin('outerCm', $event)" />
      </div>
    </template>
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
  // { pages: [{left,top,width,height}] } (coords écran) émis par FolioView.
  geometry: { type: Object, default: null },
})

const header = computed(() => props.styleDefaults.runningTitles.header)
const footer = computed(() => props.styleDefaults.runningTitles.footer)

// Pied symétrique : un seul choix, écrit recto ET verso.
const footerContent = computed({
  get: () => footer.value.recto,
  set: (v) => { footer.value.recto = v; footer.value.verso = v },
})

// Numérotation du folio : GLOBALE au livre (pas par bande), d'où sa place à côté
// de `header`/`footer` dans le modèle.
const folioFormat = computed({
  get: () => props.styleDefaults.runningTitles.folioFormat ?? 'numerique',
  set: (v) => { props.styleDefaults.runningTitles.folioFormat = v },
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
// Style de numérotation, montré par l'exemple : « 1 » vaut mieux qu'« arabe ».
const FOLIO_FORMAT_OPTIONS = [
  { value: 'numerique', label: '1' },
  { value: 'romain', label: 'I' },
  { value: 'alpha', label: 'a' },
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

// ── Géométrie : origine (rect de cet overlay), ancres, positions ─────────────
const rootRef = ref(null)
const origin = ref({ left: 0, top: 0 })
const box = ref({ w: 0, h: 0 })

const anchors = computed(() =>
  buildFormatAnchors({
    pages: props.geometry?.pages ?? null,
    pageSize: effective.value,
    margins: marginsView.value,
    runningTitles: props.styleDefaults.runningTitles,
    origin: origin.value,
  }),
)

const GAP = 22 // écart rail ↔ bord droit du verso

// Repères de la planche en coordonnées LOCALES de l'overlay.
const geo = computed(() => {
  const g = props.geometry?.pages
  if (!g || g.length < 2) return null
  const o = origin.value
  const loc = (r) => ({ left: r.left - o.left, top: r.top - o.top, right: r.left - o.left + r.width, bottom: r.top - o.top + r.height })
  const recto = loc(g[0])
  const verso = loc(g[1])
  const top = recto.top
  const bottom = Math.max(recto.bottom, verso.bottom)
  const midY = (top + bottom) / 2
  return {
    railX: verso.right + GAP, top, bottom, midY,
    rectoCenterX: (recto.left + recto.right) / 2,
    versoCenterX: (verso.left + verso.right) / 2,
    // Label des fonds : à mi-chemin entre l'en-tête (haut) et les dimensions (milieu).
    fondY: (top + midY) / 2,
  }
})

function bandStyle(bx) {
  return { left: `${bx.x + bx.w / 2}px`, top: `${bx.y + bx.h / 2}px` }
}

// ── Survol : la zone désignée par le contrôle survolé se marque ───────────────
const hovered = ref(null)

// Zone de chaque contrôle, APLATIE : une zone porte un rect par page (cf.
// formatAnchors), tous marqués ensemble sous la même clé. Que des zones PRÉCISES :
// la planche entière n'en a pas — elle couvrirait tout l'aperçu d'une surface
// réceptive au survol, pour ne montrer que ce qu'on regarde déjà.
const zoneList = computed(() => {
  const a = anchors.value
  return [
    ['blanc-tete', a['zone-blanc-tete']],
    ['blanc-pied', a['zone-blanc-pied']],
    ['petit-fond', a['zone-petit-fond']],
    ['grand-fond', a['zone-grand-fond']],
    ['header', a['zone-header']],
    ['footer', a['zone-footer']],
  ].flatMap(([key, rects]) => (rects ?? []).map((rect, i) => ({ key, id: `${key}:${i}`, rect })))
})

function rectStyle(r) {
  return { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` }
}

// Le rect d'une zone le plus proche d'une abscisse : les fonds en ont un par page,
// le trait doit viser celui de la page où son label est posé.
function nearestRect(rects, x) {
  if (!rects?.length) return null
  return rects.reduce((best, r) => (Math.abs(r.x + r.w / 2 - x) < Math.abs(best.x + best.w / 2 - x) ? r : best))
}

// Lignes de la COLONNE de droite : fuyante depuis le rail (railX, centre de ligne).
const RAIL_KEYS = ['blanc-tete', 'header-height', 'footer-height', 'blanc-pied']
// Fonds : label posé sur la page, trait HORIZONTAL vers le centre de son liséré.
const FOND_KEYS = ['petit-fond', 'grand-fond']

const rowEls = new Map()
function setRow(key, el) {
  if (el) rowEls.set(key, el)
  else rowEls.delete(key)
}

const leaders = ref([])
const rail = ref(null)

// Deux temps : poser l'origine (→ ancres + positions recalculées), puis, le DOM à
// jour, mesurer chaque ligne pour tracer les fuyantes depuis son point d'accroche.
async function measure() {
  const root = rootRef.value
  if (!root) return
  const r = root.getBoundingClientRect()
  origin.value = { left: r.left, top: r.top }
  box.value = { w: r.width, h: r.height }

  await nextTick()
  const anc = anchors.value
  const o = origin.value
  const railX = geo.value?.railX ?? 0
  const cys = []
  const next = []
  for (const key of RAIL_KEYS) {
    const el = rowEls.get(key)
    if (!el) continue
    const rr = el.getBoundingClientRect()
    const cy = rr.top - o.top + rr.height / 2
    cys.push(cy)
    if (anc[key]) next.push({ key, x1: railX, y1: cy, x2: anc[key].x, y2: anc[key].y })
  }
  // Fonds : trait horizontal du bord gauche du label au centre de son liséré, sur
  // la page où le label est posé (la zone en couvre deux).
  for (const key of FOND_KEYS) {
    const el = rowEls.get(key)
    if (!el) continue
    const rr = el.getBoundingClientRect()
    const z = nearestRect(anc[`zone-${key}`], rr.left - o.left + rr.width / 2)
    if (!z) continue
    const cy = rr.top - o.top + rr.height / 2
    next.push({ key, x1: rr.left - o.left, y1: cy, x2: z.x + z.w / 2, y2: cy })
  }
  leaders.value = next
  rail.value = cys.length ? { x: railX, y1: Math.min(...cys), y2: Math.max(...cys) } : null
}

let ro = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(rootRef.value)
})
onBeforeUnmount(() => ro?.disconnect())

watch(() => props.geometry, measure)
watch(() => props.styleDefaults, measure, { deep: true })
</script>

<style scoped>
.fc {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Au-dessus de l'iframe du FolioView (z-index 1 en double-page). */
  z-index: 3;
}

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

/* Fuyante du contrôle survolé : elle s'affirme (encre pleine, accent). */
.fc-lead--on line,
.fc-lead--on circle {
  stroke: var(--c-accent);
  fill: var(--c-accent);
  opacity: 1;
}

/* Zone surlignable : transparente au repos (mais réceptive au survol), teintée et
   cernée d'un POINTILLÉ quand elle (ou son label) est survolée. `outline` posé
   vers l'intérieur : la zone est mesurée au pixel près sur le papier, un trait
   débordant mentirait sur sa limite. */
.fc-zone {
  position: absolute;
  pointer-events: auto;
  border-radius: var(--radius-sm);
  background: transparent;
  transition: background-color 0.12s ease;
}

.fc-zone--on {
  background: color-mix(in srgb, var(--c-accent) 16%, transparent);
  outline: 1px dotted var(--c-accent);
  outline-offset: -1px;
}

/* Groupe de selects posé sur une bande grisée. */
.fc-band {
  position: absolute;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
  pointer-events: auto;
}

/* Groupe de champs nus à droite du folio (haut = en-tête, bas = pied). */
.fc-grp {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: auto;
}

/* Groupe du bas : ferré PAR LE BAS au bas du folio (les lignes remontent). */
.fc-grp--bottom {
  transform: translateY(-100%);
}

.fc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  min-width: 12em;
  font-size: var(--fs-sm);
}

/* Ligne sans intitulé (placement d'une bande) : le champ seul, ferré à droite
   comme ceux des lignes cotées au-dessus. */
.fc-row--sub {
  justify-content: flex-end;
}

.fc-row__label {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-ink2);
  white-space: nowrap;
}

/* Dimensions : au milieu à droite du folio, centré verticalement sur le rail. */
.fc-dims {
  position: absolute;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 12em;
  pointer-events: auto;
  font-size: var(--fs-sm);
}

.fc-dims__wh {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

/* Fond : label posé sur une page, centré sur ce point. */
.fc-onpage {
  position: absolute;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
  pointer-events: auto;
  font-size: var(--fs-sm);
}

.fc-times {
  color: var(--c-ink2);
  font-size: var(--fs-xs);
}
</style>
