<template>
  <div class="analyse-view">
    <p v-if="loading" class="state">Chargement…</p>
    <p v-else-if="error" class="state state--error">{{ error }}</p>

    <template v-else>
      <!-- Bandeau global : stats du manuscrit + relance séquentielle de toutes
           les analyses (chaque card affiche son spinner quand vient son tour). -->
      <div class="stats-banner">
        <div v-for="item in statItems" :key="item.label" class="stat">
          <span class="stat-value">{{ item.value }}</span>
          <span class="stat-label">{{ item.label }}</span>
        </div>
        <p v-if="!statItems.length" class="stats-empty">
          Statistiques globales indisponibles — lancer les analyses.
        </p>

        <button type="button" class="run-all" :disabled="!!running" @click="runAll">
          <i class="pi" :class="running ? 'pi-spin pi-spinner' : 'pi-play'"></i>
          {{ running ? `Analyse : ${STEP_LABELS[running]}…` : hasAny ? 'Relancer les analyses' : 'Lancer les analyses' }}
        </button>
      </div>

      <div class="dashboard-grid">
        <VocabulaireCard />
        <LexicalCard />
        <SemantiqueCard />
        <ThemesCard />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { provideAnalyse } from '../composables/useAnalyse'
import { formatInt, formatPercent } from '../script/format'
import VocabulaireCard from './analyse/VocabulaireCard.vue'
import LexicalCard from './analyse/LexicalCard.vue'
import SemantiqueCard from './analyse/SemantiqueCard.vue'
import ThemesCard from './analyse/ThemesCard.vue'

const STEP_LABELS = {
  vocabulaire: 'vocabulaire',
  lexical: 'analyse linguistique',
  semantic: 'proximité sémantique',
  topics: 'thèmes',
}

const route = useRoute()
const { loading, error, analysis, running, fetchAnalysis, runAll } = provideAnalyse()

onMounted(fetchAnalysis)
watch(() => route.params.id, (id) => { if (id) fetchAnalysis() })

const hasAny = computed(() => {
  const a = analysis.value
  return !!(a?.wordFrequency || a?.lexical || a?.semantic || a?.topics)
})

const statItems = computed(() => {
  const g = analysis.value?.lexical?.global
  if (!g) return []
  return [
    { label: 'mots', value: formatInt(g.words) },
    { label: 'phrases', value: formatInt(g.sentences) },
    { label: 'lemmes uniques', value: formatInt(g.uniqueLemmas) },
    { label: 'mots / phrase', value: g.avgSentenceLength.toLocaleString('fr') },
    { label: 'diversité (TTR)', value: formatPercent(g.ttr) },
    { label: 'densité lexicale', value: formatPercent(g.lexicalDensity) },
  ]
})
</script>

<style>
@import '../assets/analyse.css';
</style>

<style scoped>
.analyse-view {
  padding: 1.25em;
}

.state {
  padding: 1em 0;
  opacity: 0.6;
}

.state--error {
  color: #b3261e;
  opacity: 1;
}

.stats-banner {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.4em 1.7em;
  padding: 0.4em 0.2em 1.1em;
}

.stat {
  display: flex;
  align-items: baseline;
  gap: 0.45em;
}

.stat-value {
  font-size: 1.3em;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.8em;
  opacity: 0.6;
}

.stats-empty {
  margin: 0;
  opacity: 0.6;
  font-size: 0.9em;
}

.run-all {
  margin-left: auto;
  align-self: center;
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.45em 1em;
  border: 1px solid var(--c-accent);
  background: none;
  color: var(--c-accent);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85em;
}

.run-all:disabled {
  opacity: 0.6;
  cursor: wait;
}

/* Les cards « wide » (grid-column: 1 / -1) forcent un retour à la ligne ;
   dense laisse les petites cards remonter combler les trous. */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(30em, 100%), 1fr));
  grid-auto-flow: dense;
  gap: 1em;
  align-items: start;
}
</style>
