<template>
  <UiCard title="Vocabulaire" :busy="running === 'vocabulaire'">
    <UiNote v-if="stepErrors.vocabulaire" variant="error">{{ stepErrors.vocabulaire }}</UiNote>
    <UiNote v-if="!wordFrequency">Analyse pas encore calculée pour ce document.</UiNote>
    <UiNote v-else-if="!displayedWords.length">Pas assez de texte pour une analyse lexicale.</UiNote>

    <template v-else>
      <svg
          class="viz"
          :viewBox="`0 0 ${CLOUD_W} ${CLOUD_H}`"
          role="img"
          aria-label="Nuage des mots les plus fréquents"
      >
        <g :transform="`translate(${CLOUD_W / 2}, ${CLOUD_H / 2})`">
          <text
              v-for="word in placedWords"
              :key="word.text"
              class="cloud-word"
              :class="{ 'cloud-word--active': selected === word.text, 'cloud-word--alt': word.alt }"
              :transform="`translate(${word.x}, ${word.y}) rotate(${word.rotate})`"
              :font-size="word.size"
              @click="selected = selected === word.text ? null : word.text"
          >
            {{ word.text }}
            <title>{{ word.text }} — {{ word.count }} occurrence{{ word.count > 1 ? 's' : '' }}</title>
          </text>
        </g>
      </svg>

      <div v-if="selectedEntry" class="word-detail">
        <h3>« {{ selectedEntry.word }} » — {{ selectedEntry.count }} occurrence{{ selectedEntry.count > 1 ? 's' : '' }}</h3>
        <NodesTable :nodes="selectedEntry.nodes" @open="goToNode" />
      </div>
    </template>
  </UiCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import cloud from 'd3-cloud'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import NodesTable from './NodesTable.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { analysis, running, stepErrors, goToNode } = useAnalyse()

const MAX_DISPLAYED_WORDS = 150
const CLOUD_W = 640
const CLOUD_H = 400

const selected = ref(null)

const wordFrequency = computed(() => analysis.value?.wordFrequency ?? null)
const displayedWords = computed(() => wordFrequency.value?.entries.slice(0, MAX_DISPLAYED_WORDS) ?? [])
const selectedEntry = computed(
  () => wordFrequency.value?.entries.find((e) => e.word === selected.value) ?? null,
)

// ── Layout du nuage (d3-cloud) ──

// PRNG déterministe (mulberry32) injecté dans d3-cloud : même vocabulaire →
// même disposition à chaque rendu (Math.random donnerait un nuage différent
// à chaque visite).
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

const placedWords = ref([])

// Échelle en racine carrée : les fréquences sont très déséquilibrées, une
// échelle linéaire écraserait tous les mots sauf le premier. d3-cloud écarte
// silencieusement les mots qui ne tiennent plus dans le cadre — acceptable,
// ce sont les moins fréquents.
watch(
  displayedWords,
  (words) => {
    if (!words.length) {
      placedWords.value = []
      return
    }
    const maxSqrt = Math.sqrt(words[0].count)
    cloud()
      .size([CLOUD_W, CLOUD_H])
      .words(words.map((w, i) => ({
        text: w.word,
        count: w.count,
        size: Math.round(11 + (Math.sqrt(w.count) / maxSqrt) * 33),
        alt: i % 3 === 1, // deux encres alternées, purement décoratif
      })))
      .padding(2)
      .rotate((_, i) => (i > 4 && i % 7 === 0 ? 90 : 0))
      .font('Georgia')
      .fontSize((d) => d.size)
      .random(mulberry32(1234))
      .on('end', (out) => { placedWords.value = out })
      .start()
  },
  { immediate: true },
)
</script>

<style scoped>
.cloud-word {
  font-family: var(--font-serif);
  text-anchor: middle;
  fill: var(--c-accent);
  cursor: pointer;
}

.cloud-word--alt {
  fill: var(--c-ink2);
}

.cloud-word:hover,
.cloud-word--active {
  text-decoration: underline;
}

.cloud-word--active {
  font-weight: 700;
}
</style>
