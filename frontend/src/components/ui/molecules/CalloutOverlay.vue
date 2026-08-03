<template>
  <!-- Couche de LÉGENDES posée sur un schéma : des cartes de contrôles ferrées au
       bord (droite / bas) et, pour chaque ligne, un trait coudé qui va toucher la
       zone qu'elle règle. Le composant ne connaît rien au schéma — il reçoit des
       ancres déjà calculées en pixels de SA boîte (cf. script/formatAnchors.js) et
       ne s'occupe que du placement des cartes et du tracé. -->
  <div ref="rootRef" class="co">
    <svg class="co__wires" :width="box.w" :height="box.h" aria-hidden="true">
      <g v-for="w in wires" :key="w.key" class="co-wire">
        <polyline class="co-wire__lead" :points="w.points" />
        <template v-if="w.span">
          <line class="co-wire__span" :x1="w.span.x1" :y1="w.span.y1" :x2="w.span.x2" :y2="w.span.y2" />
          <line
              v-for="(t, i) in w.ticks" :key="i"
              class="co-wire__tick" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"
          />
        </template>
      </g>
    </svg>

    <div
        v-for="g in groups"
        :key="g.key"
        :ref="(el) => setEl(cardEls, g.key, el)"
        class="co-card"
        :class="[`co-card--${g.side}`, { 'co-card--off': g.dimmed }]"
        :style="cardStyle(g)"
    >
      <div v-if="g.label" class="co-card__title">
        <span>{{ g.label }}</span>
        <slot :name="`title-${g.key}`" />
      </div>
      <div
          v-for="row in g.rows"
          :key="row.key"
          :ref="(el) => setEl(rowEls, row.key, el)"
          class="co-row"
      >
        <span class="co-row__label">{{ row.label }}</span>
        <span class="co-row__field"><slot :name="row.key" /></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  // [{ key, label, side: 'right' | 'bottom', dimmed?, rows: [{ key, label,
  // anchor: { x, y, span? } | null }] }] — coordonnées en px de la boîte.
  // Une ligne sans ancre est rendue sans trait (réglage qui ne désigne rien).
  groups: { type: Array, default: () => [] },
})

// Longueur du dernier segment avant l'ancre : le coude ne colle pas au schéma.
const ELBOW = 16
// Écart minimal entre deux cartes d'un même bord.
const CARD_GAP = 10
// Demi-longueur des embouts d'accolade.
const TICK = 4

const rootRef = ref(null)
const box = ref({ w: 0, h: 0 })
// Position posée pour chaque carte (top en px à droite, left en px en bas).
const placements = ref({})
const wires = ref([])

// Refs d'éléments hors réactif : elles ne servent qu'à mesurer.
const cardEls = new Map()
const rowEls = new Map()
function setEl(store, key, el) {
  if (el) store.set(key, el)
  else store.delete(key)
}

function cardStyle(g) {
  const p = placements.value[g.key]
  if (p == null) return { visibility: 'hidden' }
  return g.side === 'bottom' ? { left: `${p}px` } : { top: `${p}px` }
}

const anchored = (g) => g.rows.filter((r) => r.anchor)

// Position VOULUE d'une carte : centrée sur ses ancres. Sans ancre, elle reste où
// la précédente l'a laissée (le balayage l'empile à la suite).
function wanted(g, size) {
  const rows = anchored(g)
  if (!rows.length) return 0
  const axis = g.side === 'bottom' ? 'x' : 'y'
  const mean = rows.reduce((s, r) => s + r.anchor[axis], 0) / rows.length
  return mean - size / 2
}

// Balayage d'un bord : les cartes sont posées au plus près de leurs ancres, dans
// l'ordre, sans se recouvrir ; le paquet est ensuite remonté s'il déborde.
function placeSide(side, extent) {
  const items = props.groups
    .filter((g) => g.side === side)
    .map((g) => {
      const el = cardEls.get(g.key)
      const size = side === 'bottom' ? (el?.offsetWidth ?? 0) : (el?.offsetHeight ?? 0)
      return { key: g.key, size, want: wanted(g, size) }
    })
    .sort((a, b) => a.want - b.want)

  let cursor = 0
  for (const it of items) {
    it.pos = Math.max(cursor, it.want)
    cursor = it.pos + it.size + CARD_GAP
  }
  const overflow = cursor - CARD_GAP - extent
  const shift = overflow > 0 ? overflow : 0
  const out = {}
  for (const it of items) out[it.key] = Math.max(0, it.pos - shift)
  return out
}

// Coude orthogonal ligne → ancre, plus l'accolade de cote quand l'ancre porte un
// segment. Deux départs seulement : bord gauche de la ligne (cartes de droite),
// bord haut de la ligne (cartes du bas).
function wireOf(row, side, rect, origin) {
  const a = row.anchor
  const s = side === 'bottom'
    ? { x: rect.left - origin.left + 14, y: rect.top - origin.top }
    : { x: rect.left - origin.left, y: rect.top - origin.top + rect.height / 2 }

  let points
  if (side === 'bottom') {
    const my = Math.min(a.y + ELBOW, s.y)
    points = `${s.x},${s.y} ${s.x},${my} ${a.x},${my} ${a.x},${a.y}`
  } else {
    const mx = a.x + ELBOW
    points = mx < s.x
      ? `${s.x},${s.y} ${mx},${s.y} ${mx},${a.y} ${a.x},${a.y}`
      : `${s.x},${s.y} ${a.x},${a.y}`
  }

  const span = a.span ?? null
  const ticks = []
  if (span) {
    const vertical = Math.abs(span.x2 - span.x1) < Math.abs(span.y2 - span.y1)
    for (const [x, y] of [[span.x1, span.y1], [span.x2, span.y2]]) {
      ticks.push(vertical
        ? { x1: x - TICK, y1: y, x2: x + TICK, y2: y }
        : { x1: x, y1: y - TICK, x2: x, y2: y + TICK })
    }
  }
  return { key: row.key, points, span, ticks }
}

// Deux temps : poser les cartes, puis (une fois le DOM à jour) mesurer les lignes
// pour tracer les traits — leur départ dépend de la position posée.
async function measure() {
  const root = rootRef.value
  if (!root) return
  const origin = root.getBoundingClientRect()
  box.value = { w: origin.width, h: origin.height }
  placements.value = { ...placeSide('right', origin.height), ...placeSide('bottom', origin.width) }

  await nextTick()
  // Une carte qui grandit (un select plus long) doit reposer le paquet.
  for (const el of cardEls.values()) ro?.observe(el)
  const next = []
  for (const g of props.groups) {
    for (const row of anchored(g)) {
      const el = rowEls.get(row.key)
      if (el) next.push(wireOf(row, g.side, el.getBoundingClientRect(), origin))
    }
  }
  wires.value = next
}

let ro = null
onMounted(() => {
  ro = new ResizeObserver(measure)
  ro.observe(rootRef.value)
  measure()
})
onBeforeUnmount(() => ro?.disconnect())

// Les ancres bougent (échelle, marges retouchées) ou une carte change de taille :
// on repose tout. `deep` — les groupes sont recalculés en amont, mais leurs lignes
// sont des objets imbriqués.
watch(() => props.groups, measure, { deep: true, flush: 'post' })

defineExpose({ measure })
</script>

<style scoped>
.co {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.co__wires {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.co-wire__lead,
.co-wire__span,
.co-wire__tick {
  fill: none;
  stroke: var(--c-ink2);
  stroke-width: 1;
  opacity: var(--op-muted);
}

.co-wire__span {
  opacity: 1;
}

/* Une carte = un pack de réglages, ferré au bord de la couche. */
.co-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-card-float);
  backdrop-filter: var(--c-backdrop-filter-blur);
  font-size: var(--fs-sm);
  pointer-events: auto;
}

.co-card--right {
  right: 0;
  width: var(--co-card-w, 13em);
}

.co-card--bottom {
  bottom: 0;
}

/* Bande désactivée : la carte reste lisible mais s'efface (ses traits aussi —
   l'appelant ne lui donne plus d'ancre). */
.co-card--off {
  opacity: var(--op-muted);
}

.co-card__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  font-weight: 600;
  color: var(--c-ink2);
}

.co-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}

.co-row__label {
  color: var(--c-ink2);
  white-space: nowrap;
}

.co-row__field {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.co-card--right .co-row {
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
}

.co-card--right .co-row__field :deep(select) {
  width: 100%;
}
</style>
