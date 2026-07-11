<template>
  <div class="analyse-view">
    <UiNote v-if="loading">Chargement…</UiNote>
    <UiNote v-else-if="error" variant="error">{{ error }}</UiNote>

    <template v-else>
      <!-- Bandeau global : une tuile par stat + relance séquentielle de
           toutes les analyses (chaque card affiche son spinner quand vient
           son tour). -->
      <div class="stats-banner">
        <StatItem v-for="item in statItems" :key="item.label" :value="item.value" :label="item.label" />
        <UiNote v-if="!statItems.length" variant="hint">
          Statistiques globales indisponibles — lancer les analyses.
        </UiNote>

        <BaseButton
            variant="accent"
            class="run-all"
            :icon="running ? null : 'pi-play'"
            :busy="!!running"
            @click="runAll"
        >
          {{ running ? `Analyse : ${STEP_LABELS[running]}…` : hasAny ? 'Relancer les analyses' : 'Lancer les analyses' }}
        </BaseButton>
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
import BaseButton from './ui/BaseButton.vue'
import StatItem from './ui/StatItem.vue'
import UiNote from './ui/UiNote.vue'
import VocabulaireCard from './analyse/VocabulaireCard.vue'
import LexicalCard from './analyse/LexicalCard.vue'
import SemantiqueCard from './analyse/SemantiqueCard.vue'
import ThemesCard from './analyse/ThemesCard.vue'

const STEP_LABELS = {
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
  return !!(a?.lexical || a?.semantic || a?.topics)
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

.stats-banner {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  gap: 0.6em;
  margin-bottom: 1em;
}

.run-all {
  margin-left: auto;
  align-self: center;
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
