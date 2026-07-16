<template>
  <UiCard bare :busy="running === 'semantic'">
    <UiNote v-if="stepErrors.semantic" variant="error">{{ stepErrors.semantic }}</UiNote>
    <template v-if="!semantic && running !== 'semantic'">
      <UiNote>
        Analyse pas encore calculée. Nécessite le service NLP local (<code>npm run dev:nlp</code>) —
        le premier calcul vectorise tous les paragraphes (plusieurs minutes) ; les suivants
        repartent du cache et ne recalculent que ce qui a changé.
      </UiNote>
      <BaseButton variant="outline" icon="pi-play" :busy="!!running" class="run-step" @click="runStep('semantic')">
        Lancer l'analyse sémantique
      </BaseButton>
    </template>

    <template v-else>
      <UiNote v-if="!focusUnit" variant="hint">
        Sélectionnez une occurrence pour voir les articles sémantiquement proches.
      </UiNote>

      <template v-else>
        <header class="focus-head">
          <p class="card-lead">
            « {{ focusUnit.titre }} » — proximité des articles
          </p>
          <BaseButton variant="solid-alt" class="focus-edit" @click="goToNode(focusNodeId)">
            Éditer <i class="pi pi-arrow-right"></i>
          </BaseButton>
        </header>
        <UiTable>
          <thead>
            <tr><th>Article proche</th><th class="score-col">Proximité</th></tr>
          </thead>
          <tbody>
            <tr
                v-for="neighbor in focusNeighbors"
                :key="neighbor.nodeId"
                class="row-link"
                title="Cliquer pour recentrer sur cet article"
                @click="focusNodeId = neighbor.nodeId"
            >
              <td>{{ neighbor.titre }}</td>
              <td class="score-col">
                <ScoreBar :pct="neighbor.score * 100" :label="formatPercent(neighbor.score)" />
              </td>
            </tr>
          </tbody>
        </UiTable>
      </template>
    </template>
  </UiCard>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import UiTable from '../ui/UiTable.vue'
import ScoreBar from '../ui/ScoreBar.vue'
import BaseButton from '../ui/BaseButton.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { formatPercent } from '../../script/format'

const { analysis, running, stepErrors, focusNodeId, goToNode, settle, runStep } = useAnalyse()

const semantic = computed(() => analysis.value?.semantic ?? null)

const semanticTitreById = computed(
  () => new Map((semantic.value?.units ?? []).map((u) => [u.nodeId, u.titre])),
)

function titreOf(nodeId) {
  return semanticTitreById.value.get(nodeId) ?? '(sans titre)'
}

// Focus piloté par la sélection d'occurrence (OccurrencesCard) via le store ;
// l'article visé n'est pas forcément une unité sémantique (segment isolé), d'où
// le repli sur null.
const focusUnit = computed(
  () => semantic.value?.units.find((u) => u.nodeId === focusNodeId.value) ?? null,
)

const focusNeighbors = computed(
  () => focusUnit.value?.neighbors.map((n) => ({ ...n, titre: titreOf(n.nodeId) })) ?? [],
)

onMounted(() => settle('semantique'))
</script>

<style scoped>
/* Légende à gauche, bouton « Éditer » calé à droite. */
.focus-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75em;
  margin-bottom: 0.75em;
}

/* Le lead partage l'en-tête avec le bouton « Éditer » : c'est le header qui
   porte l'écart avec le tableau. */
.focus-head .card-lead {
  margin-bottom: 0;
}

.focus-edit {
  flex-shrink: 0;
}

.run-step {
  margin-top: 0.75em;
}
</style>
