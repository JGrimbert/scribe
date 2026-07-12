<template>
  <UiCard bare :busy="running === 'lexical'">
    <UiNote v-if="stepErrors.lexical" variant="error">{{ stepErrors.lexical }}</UiNote>
    <UiNote v-if="!lexical">Analyse linguistique pas encore calculée pour ce document.</UiNote>
    <UiNote v-else-if="!lemmas">
      Nuage indisponible sur cette analyse — relancer l'analyse linguistique pour l'obtenir.
    </UiNote>

    <template v-else>
      <UiNote v-if="!filteredWords.length" variant="hint">
        Aucun mot pour cette sélection de natures grammaticales.
      </UiNote>

      <svg
          v-else
          class="vocab-cloud"
          :viewBox="`0 0 ${CLOUD_W} ${CLOUD_H}`"
          role="img"
          aria-label="Nuage des lemmes les plus fréquents"
      >
        <g :transform="`translate(${CLOUD_W / 2}, ${CLOUD_H / 2})`">
          <text
              v-for="word in placed"
              :key="word.text"
              class="cloud-word"
              :transform="`translate(${word.x}, ${word.y})`"
              :style="wordStyle(word)"
              @mouseenter="hovered = word.text"
              @mouseleave="hovered = null"
              @click="toggle(word.text)"
          >
            {{ word.text }}
            <title>{{ word.text }} — {{ word.count }} occurrence{{ word.count > 1 ? 's' : '' }}</title>
          </text>
        </g>
      </svg>

      <!-- Filtres sous le nuage. -->
      <ChipGroup title="Nature grammaticale" :meta="`${filteredWords.length} mots affichés`">
        <BaseChip
            v-for="filter in POS_FILTERS"
            :key="filter.key"
            :active="active[filter.key]"
            :count="countByKey[filter.key]"
            @click="active[filter.key] = !active[filter.key]"
        >
          {{ filter.label }}
        </BaseChip>
      </ChipGroup>

      <!-- TEMPORAIRE : détail masqué le temps de retravailler le nuage. -->
      <div v-if="selectedEntry && !FOCUS_CLOUD" class="word-detail">
        <h3>« {{ selectedEntry.lemma }} » — {{ selectedEntry.count }} occurrence{{ selectedEntry.count > 1 ? 's' : '' }}</h3>
        <NodesTable :nodes="selectedEntry.nodes" @open="goToNode" />
      </div>
    </template>
  </UiCard>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import cloud from 'd3-cloud'
import { forceSimulation, forceX, forceY } from 'd3-force'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import ChipGroup from '../ui/ChipGroup.vue'
import BaseChip from '../ui/BaseChip.vue'
import NodesTable from './NodesTable.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { analysis, running, stepErrors, goToNode } = useAnalyse()

// TEMPORAIRE : isole le nuage (masque le détail par article) le temps de le
// retravailler. Repasser à false pour réafficher.
const FOCUS_CLOUD = true

const MAX_WORDS = 80
// Positions « maison » denses posées par d3-cloud.
const CLOUD_W = 760
const CLOUD_H = 440
const CLOUD_PADDING = 6

// États exclusifs (jamais cumulés) : actif > survol > normal. Actif = maximum.
const SCALE_HOVER = 1.05
const SCALE_ACTIVE = 1.1

// Dégradé par fréquence : mot rare (clair) → mot fréquent (teal profond).
const COLOR_LOW = '#aec4c7'
const COLOR_HIGH = '#0e7183'

// Repoussement UNIQUEMENT au clic : le mot cliqué pousse TOUT le nuage
// radialement, avec une intensité qui décroît avec la distance (diffusion
// douce). Chacun est ramené à sa position maison à la désélection.
const HOME_STRENGTH = 0.2
const VELOCITY_DECAY = 0.8
const REHEAT_ALPHA = 0.4
const REHEAT_DECAY = 0.04
const PUSH_STRENGTH = 4.5 // ampleur de la poussée radiale (↓ = plus discret)
const PUSH_RANGE = 160 // portée : distance à laquelle la poussée est ~divisée par 2

// Regroupe les POS spaCy en catégories UI. Noms communs et noms propres sont
// fusionnés sous « Noms » (l'utilisateur ne distingue pas les deux à l'œil).
const POS_FILTERS = [
  { key: 'nom', label: 'Noms', pos: ['NOUN', 'PROPN'] },
  { key: 'adj', label: 'Adjectifs', pos: ['ADJ'] },
  { key: 'verbe', label: 'Verbes', pos: ['VERB'] },
  { key: 'adverbe', label: 'Adverbes', pos: ['ADV'] },
]
const POS_TO_KEY = Object.fromEntries(POS_FILTERS.flatMap((f) => f.pos.map((p) => [p, f.key])))

// Adverbes décochés par défaut : souvent peu porteurs de sens.
const active = reactive({ nom: true, adj: true, verbe: true, adverbe: false })
const selected = ref(null)
const hovered = ref(null)

const lexical = computed(() => analysis.value?.lexical ?? null)
const lemmas = computed(() => lexical.value?.lemmas ?? null)

const countByKey = computed(() => {
  const counts = { nom: 0, adj: 0, verbe: 0, adverbe: 0 }
  for (const lemma of lemmas.value ?? []) {
    const key = POS_TO_KEY[lemma.pos]
    if (key) counts[key]++
  }
  return counts
})

// Lemmes déjà triés par fréquence décroissante côté backend (most_common) :
// on filtre par POS puis on garde le haut du panier.
const filteredWords = computed(() =>
  (lemmas.value ?? []).filter((lemma) => active[POS_TO_KEY[lemma.pos]]).slice(0, MAX_WORDS),
)

const selectedEntry = computed(
  () => lemmas.value?.find((lemma) => lemma.lemma === selected.value) ?? null,
)

function toggle(text) {
  selected.value = selected.value === text ? null : text
}

// Couleur = fréquence. Échelle en racine carrée (comme les positions maison) :
// sinon tout serait clair sauf le premier mot.
const maxCount = computed(() => placed.value.reduce((m, w) => Math.max(m, w.count), 1))

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function wordColor(count) {
  const t = Math.sqrt(count) / Math.sqrt(maxCount.value)
  const a = hexToRgb(COLOR_LOW)
  const b = hexToRgb(COLOR_HIGH)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

// Un seul état par mot (actif > survol > normal), jamais cumulé.
function wordStyle(word) {
  const isActive = word.text === selected.value
  const grow = isActive ? SCALE_ACTIVE : word.text === hovered.value ? SCALE_HOVER : 1
  return {
    fontSize: `${word.size * grow}px`,
    fontWeight: isActive ? 700 : 400,
    fill: wordColor(word.count),
  }
}

// Force radiale : le mot cliqué repousse tous les autres, intensité décroissant
// avec la distance (diffusion douce à tout le nuage).
function radialPush() {
  let nodes = []
  function force(alpha) {
    const src = selected.value ? nodes.find((n) => n.text === selected.value) : null
    if (!src) return
    for (const n of nodes) {
      if (n === src) continue
      const dx = n.x - src.x
      const dy = n.y - src.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (PUSH_STRENGTH * PUSH_RANGE) / (d + PUSH_RANGE) * alpha
      n.vx += (dx / d) * f
      n.vy += (dy / d) * f
    }
  }
  force.initialize = (n) => { nodes = n }
  return force
}

// ── Positions « maison » (d3-cloud) + repoussement au clic (d3-force) ──

// PRNG déterministe (mulberry32) : même vocabulaire → mêmes positions maison.
function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let sim = null
let simNodes = []
const placed = ref([])

function stopSim() {
  sim?.stop()
  sim = null
}
onUnmounted(stopSim)

function buildFromLayout(out) {
  simNodes = out.map((w) => ({
    text: w.text,
    count: w.count,
    size: w.size,
    hx: w.x, // position maison
    hy: w.y,
    x: w.x,
    y: w.y,
  }))

  sim = forceSimulation(simNodes)
    .velocityDecay(VELOCITY_DECAY)
    .force('x', forceX((d) => d.hx).strength(HOME_STRENGTH))
    .force('y', forceY((d) => d.hy).strength(HOME_STRENGTH))
    .force('radial', radialPush())
    .stop()

  placed.value = simNodes.slice()
  sim.on('tick', () => { placed.value = simNodes.slice() })
}

const placeCloud = (words) => {
  const maxSqrt = Math.sqrt(words[0].count)
  cloud()
    .size([CLOUD_W, CLOUD_H])
    .words(words.map((w) => ({
      text: w.lemma,
      count: w.count,
      size: Math.round(14 + (Math.sqrt(w.count) / maxSqrt) * 40),
    })))
    .spiral('archimedean')
    .padding(CLOUD_PADDING)
    .rotate(() => 0)
    .font('Georgia')
    .fontSize((d) => d.size)
    .random(mulberry32(1234))
    .on('end', buildFromLayout)
    .start()
}

watch(
  filteredWords,
  (words) => {
    stopSim()
    if (!words.length) {
      simNodes = []
      placed.value = []
      return
    }
    placeCloud(words)
  },
  { immediate: true },
)

// Seul le CLIC (sélection) déclenche le repoussement.
watch(selected, () => {
  if (!sim) return
  sim.alpha(REHEAT_ALPHA).alphaDecay(REHEAT_DECAY).restart()
})
</script>

<style scoped>
.vocab-cloud {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  margin: 0.5em 0;
}

.cloud-word {
  font-family: var(--font-serif);
  text-anchor: middle;
  dominant-baseline: central;
  cursor: pointer;
  transition: font-size 0.3s ease, fill 0.3s ease;
}

/* Filtres (footer) centrés. */
:deep(.chip-group__title) {
  text-align: center;
}

:deep(.chip-group__chips) {
  justify-content: center;
}
</style>
