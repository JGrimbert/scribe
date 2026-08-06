<template>
  <!-- Contrôles de FORMAT posés SUR l'aperçu (écran Maquette). Trois zones :
       - deux GROUPES à droite du folio (haut = en-tête, bas = pied), champs nus
         reliés à leur zone par un trait droit (rail + fuyantes, par-dessus le folio) ;
       - à droite encore, les dimensions (format + X/Y + unité), et à GAUCHE le
         groupe du grand fond + de la manchette, en miroir ;
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

    <!-- Manchette active : ses filets gris, posés dans sa colonne. Simulation de
         texte, donc décor pur — par-dessus les zones (transparentes au repos),
         mais sans jamais leur prendre le survol. -->
    <template v-if="manchette.enabled">
      <div v-for="(r, i) in manchetteLines" :key="i" class="fc-manch" :style="lineStyle(r)" />
    </template>

    <svg class="fc__wires" :width="box.w" :height="box.h" aria-hidden="true">
      <g v-for="l in leaders" :key="l.key" class="fc-lead" :class="{ 'fc-lead--on': hovered === l.key }">
        <line :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" />
        <circle :cx="l.x2" :cy="l.y2" r="2.2" />
      </g>
    </svg>

    <!-- ── Selects de contenu, posés sur les bandes grisées ─────────────────── -->
    <template v-if="header.enabled">
      <div v-if="anchors['header-recto-box']" class="fc-band"
           :style="bandSelectStyle(anchors['header-recto-box'], 'recto', header.justification)"
           @mouseenter="hovered = 'header'" @mouseleave="hovered = null">
        <BareSelect v-model="header.recto" :options="HEADER_OPTIONS" />
      </div>
      <div v-if="anchors['header-verso-box']" class="fc-band"
           :style="bandSelectStyle(anchors['header-verso-box'], 'verso', header.justification)"
           @mouseenter="hovered = 'header'" @mouseleave="hovered = null">
        <BareSelect v-model="header.verso" :options="HEADER_OPTIONS" />
      </div>
    </template>
    <template v-if="footer.enabled">
      <!-- Pied = folio : un seul select par page, le STYLE de numérotation (1 / I / a),
           réglage global au livre (même valeur des deux côtés). Placé selon la justif. -->
      <div v-if="anchors['footer-recto-box']" class="fc-band"
           :style="bandSelectStyle(anchors['footer-recto-box'], 'recto', footer.justification)"
           @mouseenter="hovered = 'footer'" @mouseleave="hovered = null">
        <BareSelect v-model="folioFormat" :options="FOLIO_FORMAT_OPTIONS" />
      </div>
      <div v-if="anchors['footer-verso-box']" class="fc-band"
           :style="bandSelectStyle(anchors['footer-verso-box'], 'verso', footer.justification)"
           @mouseenter="hovered = 'footer'" @mouseleave="hovered = null">
        <BareSelect v-model="folioFormat" :options="FOLIO_FORMAT_OPTIONS" />
      </div>
    </template>

    <template v-if="geo">
      <!-- ── Colonne GAUCHE : les cotes VERTICALES + le grand fond, ferrées par leur
           DROITE au rail gauche (intitulé côté planche, champ vers l'extérieur).
           Blanc de tête en haut, grand fond au milieu, blanc de pied en bas. Les
           blancs sont cotés sur le bord extérieur de la page de gauche (recto), le
           grand fond tombe aux bords extérieurs (marges re-miroitées, cf.
           formatAnchors). ────────────────────────────────────────────────────── -->
      <div class="fc-grp fc-grp--left" :style="{ left: `${geo.leftRailX}px`, top: `${geo.top}px` }">
        <div class="fc-row" :ref="(el) => setRow('blanc-tete', el)"
             @mouseenter="hovered = 'blanc-tete'" @mouseleave="hovered = null">
          <span class="fc-row__label">Blanc de tête</span>
          <NumInput :value="toUnit(marginsView.topCm, unit)" :step="step" :unit="unit"
                    @input="setMargin('topCm', $event)" />
        </div>
      </div>
      <div class="fc-grp fc-grp--left fc-grp--mid" :style="{ left: `${geo.leftRailX}px`, top: `${geo.fondY}px` }">
        <div class="fc-row" :ref="(el) => setRow('grand-fond', el)"
             @mouseenter="hovered = 'grand-fond'" @mouseleave="hovered = null">
          <span class="fc-row__label">Grand fond</span>
          <NumInput :value="toUnit(marginsView.outerCm, unit)" :step="step" :unit="unit"
                    @input="setMargin('outerCm', $event)" />
        </div>
      </div>
      <div class="fc-grp fc-grp--left fc-grp--bottom" :style="{ left: `${geo.leftRailX}px`, top: `${geo.bottom}px` }">
        <div class="fc-row" :ref="(el) => setRow('blanc-pied', el)"
             @mouseenter="hovered = 'blanc-pied'" @mouseleave="hovered = null">
          <span class="fc-row__label">Blanc de pied</span>
          <NumInput :value="toUnit(marginsView.bottomCm, unit)" :step="step" :unit="unit"
                    @input="setMargin('bottomCm', $event)" />
        </div>
      </div>

      <!-- ── Colonne DROITE : hauteur d'en-tête + justif (haut), manchette (milieu),
           hauteur de pied + justif (bas), ferrées par leur GAUCHE au rail droit. ── -->
      <div class="fc-grp" :style="{ left: `${geo.railX}px`, top: `${geo.top}px` }">
        <label class="fc-row" :ref="(el) => setRow('header-height', el)"
               @mouseenter="hovered = 'header'" @mouseleave="hovered = null">
          <span class="fc-row__label">
            <input type="checkbox" v-model="header.enabled" /> Hauteur en-tête
          </span>
          <NumInput :value="toUnit(header.heightCm, unit)" :step="step" :unit="unit" placeholder="auto"
                    :disabled="!header.enabled" @input="setBandHeight(header, $event)" />
        </label>
        <!-- Placement du titre courant dans la bande : select toujours sous son label. -->
        <div class="fc-row"
             @mouseenter="hovered = 'header'" @mouseleave="hovered = null">
          <BareSelect v-model="header.justification" :options="JUSTIF_OPTIONS" :disabled="!header.enabled" />
        </div>
      </div>

      <div class="fc-grp fc-grp--mid" :style="{ left: `${geo.railX}px`, top: `${geo.midY}px` }">
        <label class="fc-row" :ref="(el) => setRow('manchette', el)"
               @mouseenter="hovered = 'manchette'" @mouseleave="hovered = null">
          <span class="fc-row__label">
            <input type="checkbox" v-model="manchette.enabled" /> Manchette
          </span>
          <NumInput :value="toUnit(manchette.widthCm, unit)" :step="step" :unit="unit" placeholder="auto"
                    :disabled="!manchette.enabled" @input="setManchetteWidth($event)" />
        </label>
      </div>

      <div class="fc-grp fc-grp--bottom" :style="{ left: `${geo.railX}px`, top: `${geo.bottom}px` }">
        <label class="fc-row" :ref="(el) => setRow('footer-height', el)"
               @mouseenter="hovered = 'footer'" @mouseleave="hovered = null">
          <span class="fc-row__label">
            <input type="checkbox" v-model="footer.enabled" /> Hauteur pied
          </span>
          <NumInput :value="toUnit(footer.heightCm, unit)" :step="step" :unit="unit" placeholder="auto"
                    :disabled="!footer.enabled" @input="setBandHeight(footer, $event)" />
        </label>
        <div class="fc-row"
             @mouseenter="hovered = 'footer'" @mouseleave="hovered = null">
          <BareSelect v-model="footer.justification" :options="JUSTIF_OPTIONS" :disabled="!footer.enabled" />
        </div>
      </div>

      <!-- Petit fond : côté gouttière, label posé sur la page de droite (verso). -->
      <div class="fc-onpage" :style="{ left: `${geo.versoCenterX}px`, top: `${geo.fondY}px` }"
           :ref="(el) => setRow('petit-fond', el)"
           @mouseenter="hovered = 'petit-fond'" @mouseleave="hovered = null">
        <span class="fc-row__label">Petit fond</span>
        <NumInput :value="toUnit(marginsView.innerCm, unit)" :step="step" :unit="unit"
                  @input="setMargin('innerCm', $event)" />
      </div>

      <!-- ── Dimensions : layer flottant au-dessus de la planche, centré sur la
           gouttière. Sans zone surlignable : elles désignent la planche entière,
           qu'on voit déjà — le survol la barbouillerait pour rien. ───────────── -->
      <div class="fc-float" :style="{ left: `${geo.centerX}px`, top: `${geo.top}px` }">
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
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import BareSelect from './BareSelect.vue'
import NumInput from './NumInput.vue'
import { buildFormatAnchors } from '../../script/formatAnchors'
import { GUIDE_FILL } from '../../script/folioStyles'
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
const manchette = computed(() => props.styleDefaults.manchette)

// Le pied n'affiche plus QUE le folio (numéro de page) : on n'y choisit que le style
// de numérotation (1 / I / a). Son contenu est donc verrouillé sur `folio` des deux
// côtés dès qu'il est actif.
watchEffect(() => {
  if (footer.value.enabled) {
    footer.value.recto = 'folio'
    footer.value.verso = 'folio'
  }
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

// Cote OPTIONNELLE (hauteur de bande, largeur de manchette) : vidée ou invalide
// = null, c'est-à-dire « auto ».
function optionalCm(raw) {
  if (String(raw).trim() === '') return null
  const cm = fromUnit(raw, unit.value)
  return cm != null && cm > 0 ? cm : null
}

function setBandHeight(band, raw) {
  band.heightCm = optionalCm(raw)
}

function setManchetteWidth(raw) {
  manchette.value.widthCm = optionalCm(raw)
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
    manchette: manchette.value,
    origin: origin.value,
  }),
)

const manchetteLines = computed(() => anchors.value['manchette-lines'] ?? [])

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
    railX: verso.right + GAP, leftRailX: recto.left - GAP, top, bottom, midY,
    versoCenterX: (verso.left + verso.right) / 2,
    // Centre de la gouttière (bords intérieurs des deux pages) : ancre du layer
    // flottant des dimensions.
    centerX: (recto.right + verso.left) / 2,
    // Label du grand fond : à mi-chemin entre le blanc de tête (haut) et la
    // manchette (milieu).
    fondY: (top + midY) / 2,
  }
})

// Position d'un select de contenu sur sa bande, selon la justification : `centre`
// = centré ; `regard` = bord EXTÉRIEUR (recto affiché à gauche → bord gauche ; verso
// à droite → bord droit), le select ferré contre ce bord.
function bandSelectStyle(box, side, justif) {
  const cy = box.y + box.h / 2
  // `--fc-band-h` borne la hauteur (et la police) du select à celle de la bande
  // rendue par FolioView : il ne la dépasse jamais.
  const h = { '--fc-band-h': `${box.h}px` }
  if (justif === 'regard') {
    return side === 'recto'
      ? { ...h, left: `${box.x}px`, top: `${cy}px`, transform: 'translateY(-50%)' }
      : { ...h, left: `${box.x + box.w}px`, top: `${cy}px`, transform: 'translate(-100%, -50%)' }
  }
  return { ...h, left: `${box.x + box.w / 2}px`, top: `${cy}px`, transform: 'translate(-50%, -50%)' }
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
    ['manchette', a['zone-manchette']],
    ['header', a['zone-header']],
    ['footer', a['zone-footer']],
  ].flatMap(([key, rects]) => (rects ?? []).map((rect, i) => ({ key, id: `${key}:${i}`, rect })))
})

function rectStyle(r) {
  return { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` }
}

// Filet de manchette : peint du gris typographique du GABARIT (celui des pavés
// en-tête/pied rendus dans l'iframe), pas d'une encre de l'UI — c'est du papier.
function lineStyle(r) {
  return { ...rectStyle(r), background: GUIDE_FILL }
}

// Le rect d'une zone le plus proche d'une abscisse : les fonds en ont un par page,
// le trait doit viser celui de la page où son label est posé.
function nearestRect(rects, x) {
  if (!rects?.length) return null
  return rects.reduce((best, r) => (Math.abs(r.x + r.w / 2 - x) < Math.abs(best.x + best.w / 2 - x) ? r : best))
}

// Chaque rail porte un mix de deux fuyantes : « vers un point » (blancs, hauteurs
// de bande — le trait vise l'ancre cotée) et « horizontale vers zone » (fonds,
// manchette — le trait file vers le centre du liséré désigné).
const LEFT_POINT = ['blanc-tete', 'blanc-pied']
const LEFT_ZONE = ['grand-fond']
const RIGHT_POINT = ['header-height', 'footer-height']
const RIGHT_ZONE = ['manchette']
// Petit fond : label posé sur la page, trait HORIZONTAL vers le centre de son liséré.
const ONPAGE_KEYS = ['petit-fond']

const rowEls = new Map()
function setRow(key, el) {
  if (el) rowEls.set(key, el)
  else rowEls.delete(key)
}

const leaders = ref([])

// Ordonnée du centre d'une ligne mesurée, ou null si elle n'est pas montée.
function rowCenterY(key, oy) {
  const el = rowEls.get(key)
  if (!el) return null
  const rr = el.getBoundingClientRect()
  return rr.top - oy + rr.height / 2
}

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
  const leftRailX = geo.value?.leftRailX ?? 0
  const next = []

  // Fuyante « vers un point » : du bord de la carte (ferrée au rail) vers l'ancre cotée.
  const pointLead = (key, rx) => {
    const cy = rowCenterY(key, o.top)
    if (cy != null && anc[key]) next.push({ key, x1: rx, y1: cy, x2: anc[key].x, y2: anc[key].y })
  }
  // Fuyante horizontale « vers zone » : du bord de la carte au centre du liséré le
  // PLUS PROCHE (une zone en couvre deux, une par page).
  const zoneLead = (key, rx) => {
    const cy = rowCenterY(key, o.top)
    if (cy == null) return
    const z = nearestRect(anc[`zone-${key}`], rx)
    if (z) next.push({ key, x1: rx, y1: cy, x2: z.x + z.w / 2, y2: cy })
  }

  for (const key of LEFT_POINT) pointLead(key, leftRailX)
  for (const key of LEFT_ZONE) zoneLead(key, leftRailX)
  for (const key of RIGHT_POINT) pointLead(key, railX)
  for (const key of RIGHT_ZONE) zoneLead(key, railX)

  // Label posé sur une page : le trait part de son bord gauche, même règle de zone.
  for (const key of ONPAGE_KEYS) {
    const el = rowEls.get(key)
    if (!el) continue
    const rr = el.getBoundingClientRect()
    const z = nearestRect(anc[`zone-${key}`], rr.left - o.left + rr.width / 2)
    if (!z) continue
    const cy = rr.top - o.top + rr.height / 2
    next.push({ key, x1: rr.left - o.left, y1: cy, x2: z.x + z.w / 2, y2: cy })
  }
  leaders.value = next
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
  /*border-radius: var(--radius-sm);*/
  background: transparent;
  transition: background-color 0.12s ease;
}

.fc-zone--on {
  background: color-mix(in srgb, var(--c-accent2) 16%, transparent);
  outline: 1px dotted var(--c-accent);
  outline-offset: -1px;
}

/* Filet de manchette : simulation de texte, jamais un contrôle — il ne prend ni
   le survol (la zone dessous le garde) ni le clic. */
.fc-manch {
  position: absolute;
  pointer-events: none;
}

/* Selects de contenu (titre courant / folio) posés sur la bande. Chacun porte SON
   propre fond gris — le pavé gris peint dans l'iframe a été retiré (cf. folioStyles). */
.fc-band {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  /* Ne dépasse jamais la hauteur de la bande en-tête/pied rendue par FolioView. */
  height: var(--fc-band-h, auto);
  white-space: nowrap;
  pointer-events: auto;
}

.fc-band :deep(.bare-select) {
  height: 100%;
}

/* Fond teal léger (gris bleuté), franc sans radius — le pavé gris de l'iframe est
   retiré, ce select EST le repère du titre courant / folio. Hauteur et police
   bornées à la bande : le select tient dedans, sans la déborder. */
.fc-band :deep(.bare-select select) {
  height: 100%;
  padding-top: 0;
  padding-bottom: 0;
  line-height: 1;
  border-radius: 0;
  border-color: transparent;
  background: color-mix(in srgb, var(--c-accent-alt) 30%, var(--c-surface0));
  color: var(--c-accent-alt-darker);
  font-size: min(var(--fs-sm), calc(var(--fc-band-h, 1rem) - 4px));
}

/* Groupe de champs nus à droite du folio (haut = en-tête, bas = pied). */
.fc-grp {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: auto;
}

/* Groupe centré sur son ordonnée (manchette, colonne de droite). */
.fc-grp--mid {
  transform: translateY(-50%);
}

/* Groupe du bas : ferré PAR LE BAS au bas du folio (les lignes remontent). */
.fc-grp--bottom {
  transform: translateY(-100%);
}

/* Colonne de GAUCHE : ferrée par la DROITE à son rail (intitulé côté planche, champ
   vers l'extérieur) — miroir de la colonne de droite. Position verticale par
   modifieur : haut par défaut, centrée (--mid) ou basse (--bottom), les combinés
   l'emportant en spécificité. */
.fc-grp--left {
  transform: translateX(-100%);
}

.fc-grp--left.fc-grp--mid {
  transform: translate(-100%, -50%);
}

.fc-grp--left.fc-grp--bottom {
  transform: translate(-100%, -100%);
}

/* Colonne de gauche : contenu ferré à DROITE (vers la planche). */
.fc-grp--left .fc-row {
  align-items: flex-end;
}

/* Une cote = intitulé puis champ, EMPILÉS, avec un peu de padding pour aérer. */
.fc-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-1);
  padding: var(--sp-2) var(--sp-6);
  font-size: var(--fs-sm);
}

.fc-row__label {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-ink2);
  white-space: nowrap;
  font-weight: 600;
}

/* Cases à cocher aux couleurs Scribe (teal). */
.fc-row__label input[type="checkbox"] {
  accent-color: var(--c-accent-alt);
}

/* Dimensions : layer flottant au-dessus de la planche, centré sur la gouttière. */
.fc-float {
  position: absolute;
  transform: translate(-50%, calc(-100% - var(--sp-3)));
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
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
