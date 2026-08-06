<template>
  <!-- Callouts de STYLES posés SUR la planche (liminaire OU chapitrage) : une pile de
       FcStyleRow ferrée au rail droit du spread, chaque ligne reliée par une fuyante
       au premier paragraphe qui porte ce style (ancrage `data-style` via
       `styleGeometry`). Colonnes opt-in par source : « ce qui précède » (les deux),
       « exigé » (chapitrage). Les mutations passent par la typologie injectée
       (stylePrecedence / openStyleEditor / toggleRequireStyle) et le v-model de
       styleRoles ; l'aside garde sa table en parallèle. -->
  <div ref="rootRef" class="lc">
    <svg class="lc__wires" :width="box.w" :height="box.h" aria-hidden="true">
      <g v-for="l in leaders" :key="l.key" class="lc-lead" :class="{ 'lc-lead--on': hovered === l.key }">
        <line :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" />
        <circle :cx="l.x2" :cy="l.y2" r="2.2" />
      </g>
    </svg>

    <!-- Deux colonnes : chaque style se pose du côté de la balise qu'il vise (rail
         gauche si son texte tombe à gauche de la gouttière, rail droit sinon). -->
    <template v-for="col in columns" :key="col.side">
      <FcGroup v-if="col.list.length" :x="col.x" :y="col.top" :side="col.side" anchor="top">
        <FcStyleRow
            v-for="style in col.list" :key="style.name"
            :item="style"
            :role="styleRoles[style.name]"
            :precedes="precedesOf(style.name)"
            :precedes-locked="precedesLocked(style)"
            :modified="isModified(style.name)"
            :can-edit="!!openStyleEditor"
            :show-require="showRequire"
            :required="isRequired(style.name)"
            :measure-ref="(el) => setRow(style.name, el)"
            @hover="onHover"
            @edit="openStyleEditor && openStyleEditor($event)"
            @update:role="setRole(style.name, $event)"
            @update:precedes="setPrecedes(style.name, $event)"
            @toggle-require="onToggleRequire(style.name)" />
      </FcGroup>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FcGroup from './callouts/FcGroup.vue'
import FcStyleRow from './callouts/FcStyleRow.vue'
import './callouts/callouts.css'

const props = defineProps({
  // { pages: [{left,top,width,height}] } (coords écran) émis par FolioView.
  geometry: { type: Object, default: null },
  // { [styleName]: { left, top, width, height } } — 1re occurrence visible de chaque
  // style (coords écran, émis par FolioView `@style-geometry`).
  styleGeometry: { type: Object, default: () => ({}) },
  // Styles à poser (forme StyleRolesTable : { name, declared? }), ordre de lecture.
  styles: { type: Array, default: () => [] },
  // Map réactive rôle-par-style, mutée en place (comme la table de l'aside).
  styleRoles: { type: Object, required: true },
  // Zone (clé de zones.js) : verrouille le « précède » de la 1re ligne liminaire.
  zoneKey: { type: String, default: null },
  // Colonne « exigé » (chapitrage) : requiert `depthKey` + `ruleSet`.
  showRequire: { type: Boolean, default: false },
  depthKey: { type: Number, default: null },
  ruleSet: { type: Object, default: null },
})

const emit = defineEmits(['hover-style'])

// Injections partagées avec StyleRolesTable (fournies par MaquetteView).
const stylePrecedence = inject('stylePrecedence', null)
const openStyleEditor = inject('openStyleEditor', null)
const styleOverrides = inject('styleOverrides', null)
const toggleRequireStyle = inject('toggleRequireStyle', null)

const precedesOf = (name) => stylePrecedence?.[name] ?? 'none'
function setPrecedes(name, kind) {
  if (!stylePrecedence) return
  if (kind === 'none') delete stylePrecedence[name]
  else stylePrecedence[name] = kind
}
function setRole(name, role) {
  props.styleRoles[name] = role
}
function isModified(name) {
  return !!styleOverrides?.[name]
}
function isRequired(name) {
  return !!props.ruleSet?.requiresStyles?.includes(name)
}
function onToggleRequire(name) {
  if (toggleRequireStyle && props.depthKey != null) toggleRequireStyle(props.depthKey, name)
}
// 1re page du liminaire = « Page de garde » (folio 0) : le tout premier style suit
// toujours une blanche → select figé sur « blank » (présentation seule, cf.
// StyleRolesTable.precedesLocked). Ne vaut QUE pour la zone liminaire.
function precedesLocked(style) {
  return props.zoneKey === 'liminaire' && props.styles[0]?.name === style.name
}

function onHover(name) {
  hovered.value = name
  emit('hover-style', name)
}

// ── Géométrie : origine (rect de cet overlay), rail droit, haut de planche ───────
const rootRef = ref(null)
const origin = ref({ left: 0, top: 0 })
const box = ref({ w: 0, h: 0 })

const GAP = 22 // écart rail ↔ bord droit du verso (même valeur que les callouts de format)

const geo = computed(() => {
  const g = props.geometry?.pages
  if (!g || g.length < 2) return null
  const o = origin.value
  const loc = (r) => ({ left: r.left - o.left, top: r.top - o.top, right: r.left - o.left + r.width })
  const recto = loc(g[0]) // page affichée à GAUCHE (recto en séquentiel)
  const verso = loc(g[1]) // page affichée à DROITE
  return {
    leftRailX: recto.left - GAP,
    railX: verso.right + GAP,
    top: recto.top,
    // Frontière gouttière : arbitre le côté de chaque style (fuyante non traversante).
    midX: (recto.right + verso.left) / 2,
  }
})

// Style visé à GAUCHE de la gouttière (centre de son rect) ? Sans rect (style hors
// planche visible) → rangé à droite par défaut.
function onLeftPage(style) {
  const rect = props.styleGeometry?.[style.name]
  if (!rect || !geo.value) return false
  return (rect.left - origin.value.left + rect.width / 2) < geo.value.midX
}

// Répartition gauche/droite des styles, puis les deux colonnes (rail + liste).
const columns = computed(() => {
  const g = geo.value
  if (!g) return []
  const left = [], right = []
  for (const style of props.styles) (onLeftPage(style) ? left : right).push(style)
  return [
    { side: 'left', x: g.leftRailX, top: g.top, list: left },
    { side: 'right', x: g.railX, top: g.top, list: right },
  ]
})

// ── Survol : la fuyante de la ligne survolée s'affirme ───────────────────────────
const hovered = ref(null)

const rowEls = new Map()
function setRow(key, el) {
  if (el) rowEls.set(key, el)
  else rowEls.delete(key)
}

const leaders = ref([])

function rowCenterY(key, oy) {
  const el = rowEls.get(key)
  if (!el) return null
  const rr = el.getBoundingClientRect()
  return rr.top - oy + rr.height / 2
}

// Deux temps : poser l'origine (→ géométrie recalculée), puis, le DOM à jour, mesurer
// chaque ligne pour tracer sa fuyante vers le paragraphe qui porte son style. Départ
// au rail (bord gauche de la pile, côté planche) ; arrivée au bord droit du rect du
// paragraphe (le plus proche du rail), centré verticalement.
async function measure() {
  const root = rootRef.value
  if (!root) return
  const r = root.getBoundingClientRect()
  origin.value = { left: r.left, top: r.top }
  box.value = { w: r.width, h: r.height }

  await nextTick()
  const o = origin.value
  const g = geo.value
  const next = []
  for (const style of props.styles) {
    const cy = rowCenterY(style.name, o.top)
    if (cy == null || !g) continue
    const rect = props.styleGeometry?.[style.name]
    if (!rect) continue
    // La fuyante part du rail du CÔTÉ visé et vise le bord du rect le plus proche.
    const onLeft = (rect.left - o.left + rect.width / 2) < g.midX
    const x1 = onLeft ? g.leftRailX : g.railX
    const x2 = onLeft ? (rect.left - o.left) : (rect.left - o.left + rect.width)
    const y2 = rect.top - o.top + rect.height / 2
    next.push({ key: style.name, x1, y1: cy, x2, y2 })
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
watch(() => props.styleGeometry, measure)
watch(() => props.styles, measure)
watch(() => props.styleRoles, measure, { deep: true })
</script>

<style scoped>
.lc {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Au-dessus de l'iframe du FolioView (z-index 1 en double-page). */
  z-index: 3;
}

.lc__wires {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
}

.lc-lead line {
  stroke: var(--c-ink2);
  stroke-width: 1;
  opacity: var(--op-muted);
}

.lc-lead circle {
  fill: var(--c-ink2);
  opacity: var(--op-muted);
}

/* Fuyante de la ligne survolée : encre pleine, accent. */
.lc-lead--on line,
.lc-lead--on circle {
  stroke: var(--c-accent);
  fill: var(--c-accent);
  opacity: 1;
}
</style>
