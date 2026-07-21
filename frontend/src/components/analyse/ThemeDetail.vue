<template>
  <!-- Détail du thème sélectionné : mots caractéristiques puis présence par axe. -->
  <template v-if="selectedTopic">
    <UiCard bare>
      <p class="card-lead">
        Thème « {{ selectedTopic.label }} » — {{ selectedTopic.count }} segments
        ({{ formatPercent(selectedTopic.share) }})
      </p>
      <div class="topic-words">
        <span
            v-for="word in selectedTopic.words"
            :key="word.word"
            class="topic-word"
            :style="{ opacity: 0.55 + 0.45 * (word.weight / selectedTopic.words[0].weight) }"
        >
          {{ word.word }}
        </span>
      </div>
    </UiCard>

    <UiCard bare>
      <p class="card-lead">Présence par axe</p>
      <UiTable flat>
        <tbody>
          <tr v-for="row in byAxe" :key="row.axeId ?? 'liminaire'">
            <td>{{ row.titre }}</td>
            <td class="score-col">
              <ScoreBar :pct="row.pct" :label="`${row.count} / ${row.segments}`" />
            </td>
          </tr>
        </tbody>
      </UiTable>
    </UiCard>
  </template>

  <UiCard v-else bare>
    <UiNote variant="hint">
      Cliquer un thème pour son détail : mots caractéristiques et présence par axe.
    </UiNote>
  </UiCard>
</template>

<script setup>
import { computed } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import UiTable from '../ui/UiTable.vue'
import ScoreBar from '../ui/ScoreBar.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { formatPercent } from '../../script/format'

const { topics, selectedTopic } = useAnalyse()

// Présence du thème dans chaque axe, en % des segments de l'axe (pas du total :
// les axes n'ont pas tous la même longueur).
const byAxe = computed(() => {
  if (!selectedTopic.value || !topics.value) return []
  const topicId = selectedTopic.value.topicId
  return topics.value.axes.map((axe) => {
    const count = axe.distribution.find((d) => d.topicId === topicId)?.count ?? 0
    return {
      axeId: axe.axeId,
      titre: axe.titre,
      segments: axe.segments,
      count,
      pct: axe.segments ? (count / axe.segments) * 100 : 0,
    }
  })
})
</script>

<style scoped>
.topic-words {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em 0.8em;
  font-family: var(--font-serif);
  font-size: 1.05em;
  color: var(--c-accent);
}
</style>
