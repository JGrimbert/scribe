<template>
  <UiCard bare>
    <UiNote v-if="stepErrors.lexical" variant="error">{{ stepErrors.lexical }}</UiNote>
    <UiNote v-if="!lexical">Analyse linguistique pas encore calculée pour ce document.</UiNote>
    <UiNote v-else-if="!lemmas">
      Nuage indisponible sur cette analyse — relancer l'analyse linguistique pour l'obtenir.
    </UiNote>

    <template v-else>
      <header class="cloud-head">
        <h3 class="cloud-title">
          <i v-if="running === 'lexical'" class="pi pi-spin pi-spinner cloud-busy"></i>
        </h3>
        <label class="cloud-max">
          <span>Mots affichés</span>
          <BaseSelect :model-value="maxWords" @update:model-value="maxWords = Number($event)">
            <option v-for="n in MAX_WORDS_OPTIONS" :key="n" :value="n">{{ n }}</option>
          </BaseSelect>
        </label>
      </header>

      <!-- Le nuage occupe tout l'espace entre l'en-tête (ferré haut) et les
           filtres (ferrés bas), et s'y centre. -->
      <div class="cloud-body">
        <UiNote v-if="!words.length" variant="hint">
          Aucun mot pour cette sélection de natures grammaticales.
        </UiNote>

        <svg
            v-else
            class="vocab-cloud"
            :viewBox="`0 0 ${CLOUD_W + CLOUD_MARGIN * 2} ${CLOUD_H + CLOUD_MARGIN * 2}`"
            role="img"
            aria-label="Nuage des lemmes les plus fréquents"
        >
          <g :transform="`translate(${CLOUD_W / 2 + CLOUD_MARGIN}, ${CLOUD_H / 2 + CLOUD_MARGIN})`">
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
      </div>

      <!-- Filtres ferrés en bas du bloc, sur deux lignes : natures grammaticales
           puis entités (Personnes/Lieux, distinguées en teal). Chaque chip :
           items distincts de la catégorie · part des occurrences. -->
      <div class="cloud-foot">
        <ChipGroup>
          <BaseChip
              v-for="filter in POS_FILTERS"
              :key="filter.key"
              :active="active[filter.key]"
              @click="active[filter.key] = !active[filter.key]"
          >
            {{ filter.label }}
            <span class="chip-stats">{{ statLabel(filterStats[filter.key]) }}</span>
          </BaseChip>
        </ChipGroup>
        <ChipGroup class="entity-filters">
          <BaseChip
              v-for="filter in ENTITY_FILTERS"
              :key="filter.key"
              :active="active[filter.key]"
              @click="active[filter.key] = !active[filter.key]"
          >
            {{ filter.label }}
            <span class="chip-stats">{{ statLabel(filterStats[filter.key]) }}</span>
          </BaseChip>
        </ChipGroup>
      </div>
    </template>
  </UiCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import ChipGroup from '../ui/ChipGroup.vue'
import BaseChip from '../ui/BaseChip.vue'
import BaseSelect from '../ui/BaseSelect.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { useCloudFilters } from '../../composables/useCloudFilters'
import { useWordCloud } from '../../composables/useWordCloud'

const { analysis, running, stepErrors, selectedLemma, settle } = useAnalyse()

const lexical = computed(() => analysis.value?.lexical ?? null)
const lemmas = computed(() => lexical.value?.lemmas ?? null)

// Nombre de mots affichés, réglable depuis l'en-tête (le backend en fournit
// jusqu'à 300). Le nuage se recompose quand la valeur change (via `words`).
const MAX_WORDS_OPTIONS = [40, 80, 120, 160, 200]
const maxWords = ref(80)

const { active, POS_FILTERS, ENTITY_FILTERS, filterStats, statLabel, words: allWords, filteredWords } =
  useCloudFilters(lexical)

const words = computed(() => filteredWords.value.slice(0, maxWords.value))

const { placed, selected, hovered, toggle, wordStyle, CLOUD_W, CLOUD_H, CLOUD_MARGIN } =
  useWordCloud(words, () => settle('cloud'))

// Pont vers l'état partagé : le mot sélectionné dans le nuage pilote le détail
// des occurrences (OccurrencesCard) et la proximité (SemantiqueCard). Les mots
// (communs comme entités) portent { text, count, nodes } → forme attendue
// d'OccurrencesCard { lemma, count, nodes }.
const wordByText = computed(() => new Map(allWords.value.map((w) => [w.text, w])))
watch(
  selected,
  (text) => {
    const w = text ? wordByText.value.get(text) : null
    selectedLemma.value = w ? { lemma: w.text, count: w.count, nodes: w.nodes } : null
  },
  { immediate: true },
)
</script>

<style scoped>
/* En-tête du nuage : titre ferré en haut à gauche, réglage des mots à droite. */
.cloud-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1em;
}

.cloud-title {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--c-ink);
}

.cloud-busy {
  margin-left: 0.4em;
  font-size: 0.85em;
  color: var(--c-accent);
}

.cloud-max {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  font-size: var(--fs-sm);
  opacity: var(--op-muted);
}

/* Zone centrale : occupe tout l'espace entre l'en-tête et les filtres, le nuage
   s'y centre verticalement. min-height : plancher pour ne pas s'écraser quand la
   colonne de droite est courte. */
.cloud-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 18em;
}

.vocab-cloud {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* Filtres ferrés en bas. */
.cloud-foot {
  margin-top: 0.5em;
}

.cloud-word {
  font-family: var(--font-serif);
  text-anchor: middle;
  dominant-baseline: central;
  cursor: pointer;
  transition: font-size 0.3s ease, fill 0.3s ease;
}

/* Les trois nombres d'un chip (mots distincts · occurrences · part). */
.chip-stats {
  opacity: var(--op-muted);
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}

/* Filtres centrés sous le nuage. */
:deep(.chip-group__chips) {
  justify-content: center;
}

/* Deuxième ligne : entités nommées, distinguées en teal (couleur du nuage). */
.entity-filters {
  margin-top: var(--sp-2);
}

.entity-filters :deep(.base-chip):hover,
.entity-filters :deep(.base-chip--active) {
  border-color: var(--c-accent-alt);
  color: var(--c-accent-alt);
}
</style>
