<template>
  <div class="custom-scrollbar" ref="containerEl">
    <div class="custom-scrollbar__content" ref="contentEl" @scroll="measure">
      <slot />
    </div>

    <div
        v-if="shown.y"
        class="custom-scrollbar__track custom-scrollbar__track--y"
        :style="trackStyle('y')"
        @mousedown.self="onTrackMouseDown('y', $event)"
    >
      <button
          class="custom-scrollbar__arrow custom-scrollbar__arrow--up"
          @mousedown.prevent="startStepping('y', -1)"
      ></button>
      <div
          class="custom-scrollbar__thumb custom-scrollbar__thumb--y"
          :style="thumbStyle('y')"
          @mousedown.prevent="startDrag('y', $event)"
      ></div>
      <button
          class="custom-scrollbar__arrow custom-scrollbar__arrow--down"
          @mousedown.prevent="startStepping('y', 1)"
      ></button>
    </div>

    <div
        v-if="shown.x"
        class="custom-scrollbar__track custom-scrollbar__track--x"
        :style="trackStyle('x')"
        @mousedown.self="onTrackMouseDown('x', $event)"
    >
      <button
          class="custom-scrollbar__arrow custom-scrollbar__arrow--left"
          @mousedown.prevent="startStepping('x', -1)"
      ></button>
      <div
          class="custom-scrollbar__thumb custom-scrollbar__thumb--x"
          :style="thumbStyle('x')"
          @mousedown.prevent="startDrag('x', $event)"
      ></div>
      <button
          class="custom-scrollbar__arrow custom-scrollbar__arrow--right"
          @mousedown.prevent="startStepping('x', 1)"
      ></button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  // Décale le départ de la track verticale, pour la faire commencer sous une
  // barre flottante qui recouvre le haut de la zone de scroll (DocumentBar).
  // N'affecte que la track : le contenu, lui, doit bien défiler dessous.
  topOffset: { type: Number, default: 0 },
})

const containerEl = ref(null)
const contentEl = ref(null)

const TRACK = 12    // épaisseur de la track (et côté d'une flèche)
const MIN_THUMB = 20
const STEP = 40     // px par cran de flèche
const HOLD_DELAY = 300
const HOLD_INTERVAL = 40

// Tout ce qui distingue les deux axes, pour ne décrire la géométrie qu'une fois.
const AXES = {
  y: { scroll: 'scrollTop', size: 'scrollHeight', client: 'clientHeight', page: 'clientY' },
  x: { scroll: 'scrollLeft', size: 'scrollWidth', client: 'clientWidth', page: 'clientX' },
}

const metrics = reactive({
  y: { viewport: 0, content: 0, scroll: 0, track: 0 },
  x: { viewport: 0, content: 0, scroll: 0, track: 0 },
})

// Mesure les deux axes depuis la MÊME source (contentEl) : `clientHeight` et
// `scrollHeight` sont tous deux arrondis à l'entier, donc `maxScroll` vaut
// exactement 0 quand rien ne déborde. Comparer un getBoundingClientRect()
// fractionnaire à un scrollHeight entier ne donnait jamais l'égalité.
function measure() {
  const el = contentEl.value
  const box = containerEl.value
  if (!el || !box) return

  for (const key of ['y', 'x']) {
    const axis = AXES[key]
    metrics[key].viewport = el[axis.client]
    metrics[key].content = el[axis.size]
    metrics[key].scroll = el[axis.scroll]
  }

  // Chaque track cède la place à l'autre à leur intersection, et la verticale
  // démarre sous `topOffset`.
  metrics.y.track = box.clientHeight - props.topOffset - (overflow('x') ? TRACK : 0)
  metrics.x.track = box.clientWidth - (overflow('y') ? TRACK : 0)
}

function maxScroll(key) {
  return Math.max(0, metrics[key].content - metrics[key].viewport)
}

// Tolérance : un débordement d'un pixel est un artefact d'arrondi, pas un scroll.
function overflow(key) {
  return maxScroll(key) > 1
}

const shown = computed(() => ({ y: overflow('y'), x: overflow('x') }))

// Bande utile du thumb : la track moins les deux flèches.
function thumbSpan(key) {
  return Math.max(0, metrics[key].track - 2 * TRACK)
}

function thumbLength(key) {
  const span = thumbSpan(key)
  const ratio = metrics[key].content ? metrics[key].viewport / metrics[key].content : 1
  return Math.max(MIN_THUMB, Math.min(span, span * ratio))
}

function thumbOffset(key) {
  const max = maxScroll(key)
  if (!max) return 0
  const progress = Math.min(1, Math.max(0, metrics[key].scroll / max))
  return progress * (thumbSpan(key) - thumbLength(key))
}

function trackStyle(key) {
  return key === 'y'
      ? { top: `${props.topOffset}px`, height: `${metrics.y.track}px` }
      : { left: '0px', width: `${metrics.x.track}px` }
}

function thumbStyle(key) {
  const start = TRACK + thumbOffset(key)
  return key === 'y'
      ? { height: `${thumbLength('y')}px`, transform: `translateY(${start}px)` }
      : { width: `${thumbLength('x')}px`, transform: `translateX(${start}px)` }
}

// Positionne le scroll pour que le DÉBUT du thumb tombe sur `offset` (mesuré
// depuis le début de la bande utile).
function scrollToThumbOffset(key, offset) {
  const travel = thumbSpan(key) - thumbLength(key)
  if (travel <= 0) return
  const progress = Math.min(1, Math.max(0, offset / travel))
  contentEl.value[AXES[key].scroll] = progress * maxScroll(key)
}

// ── Drag du thumb ──
const drag = ref(null)

function startDrag(key, event) {
  drag.value = { key, origin: event[AXES[key].page], offset: thumbOffset(key) }
}

function onMouseMove(event) {
  if (!drag.value) return
  const { key, origin, offset } = drag.value
  scrollToThumbOffset(key, offset + event[AXES[key].page] - origin)
}

function onMouseUp() {
  drag.value = null
  stopStepping()
}

// ── Clic dans la track (hors thumb et flèches) : saut, thumb centré ──
function onTrackMouseDown(key, event) {
  const rect = event.currentTarget.getBoundingClientRect()
  const start = key === 'y' ? rect.top : rect.left
  const click = event[AXES[key].page] - start - TRACK
  scrollToThumbOffset(key, click - thumbLength(key) / 2)
}

// ── Flèches : un cran au clic, répétition au maintien ──
let holdTimer = null

function step(key, direction) {
  if (contentEl.value) contentEl.value[AXES[key].scroll] += direction * STEP
}

function startStepping(key, direction) {
  step(key, direction)
  holdTimer = setTimeout(() => {
    holdTimer = setInterval(() => step(key, direction), HOLD_INTERVAL)
  }, HOLD_DELAY)
}

function stopStepping() {
  clearTimeout(holdTimer)
  clearInterval(holdTimer)
  holdTimer = null
}

let resizeObserver = null
let mutationObserver = null

onMounted(() => {
  measure()

  // `measure()` n'écrit que des nombres dans `metrics` : réassigner une valeur
  // identique ne déclenche aucun rendu, donc ces observers ne peuvent pas
  // s'auto-entretenir.
  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(containerEl.value)
  resizeObserver.observe(contentEl.value)

  mutationObserver = new MutationObserver(measure)
  mutationObserver.observe(contentEl.value, {
    childList: true,
    subtree: true,
    characterData: true,
  })

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  stopStepping()
})
</script>

<style scoped>
.custom-scrollbar {
  position: relative;
  height: 100%;
  width: 100%;
}

.custom-scrollbar__content {
  height: 100%;
  width: 100%;
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.custom-scrollbar__content::-webkit-scrollbar {
  display: none;
}

.custom-scrollbar__track {
  position: absolute;
  z-index: 10;
}

.custom-scrollbar__track--y {
  right: 0;
  width: 12px;
}

.custom-scrollbar__track--x {
  bottom: 0;
  height: 12px;
}

.custom-scrollbar__thumb {
  position: absolute;
  background: var(--c-accent-alt);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.2s ease;
}

.custom-scrollbar__thumb--y {
  top: 0;
  right: 3px;
  width: 6px;
}

.custom-scrollbar__thumb--x {
  left: 0;
  bottom: 3px;
  height: 6px;
}

.custom-scrollbar__thumb:hover,
.custom-scrollbar__thumb:active {
  background: var(--c-accent-alt-darker);
}

/* Flèches : triangles en bordures CSS, calées à chaque extrémité de la track. */
.custom-scrollbar__arrow {
  position: absolute;
  width: 12px;
  height: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  opacity: var(--op-soft);
}

.custom-scrollbar__arrow:hover {
  opacity: 1;
}

.custom-scrollbar__arrow::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border: 4px solid transparent;
}

.custom-scrollbar__arrow--up {
  top: 0;
  left: 0;
}

.custom-scrollbar__arrow--up::before {
  border-bottom-color: var(--c-accent-alt);
  transform: translate(-50%, -75%);
}

.custom-scrollbar__arrow--down {
  bottom: 0;
  left: 0;
}

.custom-scrollbar__arrow--down::before {
  border-top-color: var(--c-accent-alt);
  transform: translate(-50%, -25%);
}

.custom-scrollbar__arrow--left {
  left: 0;
  top: 0;
}

.custom-scrollbar__arrow--left::before {
  border-right-color: var(--c-accent-alt);
  transform: translate(-75%, -50%);
}

.custom-scrollbar__arrow--right {
  right: 0;
  top: 0;
}

.custom-scrollbar__arrow--right::before {
  border-left-color: var(--c-accent-alt);
  transform: translate(-25%, -50%);
}
</style>
