<template>
  <UiCard title="Vocabulaire" bare :busy="running === 'lexical'">
    <UiNote v-if="stepErrors.lexical" variant="error">{{ stepErrors.lexical }}</UiNote>
    <UiNote v-if="!lexical">Analyse linguistique pas encore calculée pour ce document.</UiNote>
    <UiNote v-else-if="!lemmas">
      Nuage indisponible sur cette analyse — relancer l'analyse linguistique pour l'obtenir.
    </UiNote>

    <template v-else>
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

      <UiNote v-if="!filteredWords.length" variant="hint">
        Aucun mot pour cette sélection de natures grammaticales.
      </UiNote>

      <svg
          v-else
          class="viz"
          :viewBox="`0 0 ${CLOUD_W} ${CLOUD_H}`"
          role="img"
          aria-label="Nuage des lemmes les plus fréquents"
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
        <h3>« {{ selectedEntry.lemma }} » — {{ selectedEntry.count }} occurrence{{ selectedEntry.count > 1 ? 's' : '' }}</h3>
        <NodesTable :nodes="selectedEntry.nodes" @open="goToNode" />
      </div>
    </template>
  </UiCard>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import cloud from 'd3-cloud'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import ChipGroup from '../ui/ChipGroup.vue'
import BaseChip from '../ui/BaseChip.vue'
import NodesTable from './NodesTable.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { analysis, running, stepErrors, goToNode } = useAnalyse()

const MAX_WORDS = 90
const CLOUD_W = 620
const CLOUD_H = 440

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
// échelle linéaire écraserait tous les mots sauf le premier. Spirale
// archimédienne + nombre de mots plafonné : le nuage se remplit du centre
// vers l'extérieur en blob elliptique plutôt qu'en pavage rectangulaire.
// d3-cloud écarte silencieusement les mots qui ne tiennent plus — acceptable,
// ce sont les moins fréquents.
watch(
  filteredWords,
  (words) => {
    if (!words.length) {
      placedWords.value = []
      return
    }
    const maxSqrt = Math.sqrt(words[0].count)
    cloud()
      .size([CLOUD_W, CLOUD_H])
      .words(words.map((w, i) => ({
        text: w.lemma,
        count: w.count,
        size: Math.round(12 + (Math.sqrt(w.count) / maxSqrt) * 36),
        alt: i % 3 === 1, // deux encres alternées, purement décoratif
      })))
      .spiral('archimedean')
      .padding(3)
      .rotate(() => 0)
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
.viz {
  display: block;
  width: 100%;
  height: auto;
}

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
