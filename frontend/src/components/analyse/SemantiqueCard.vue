<template>
  <AnalyseCard title="Proximité sémantique" :busy="running === 'semantic'">
    <p v-if="stepErrors.semantic" class="state state--error">{{ stepErrors.semantic }}</p>
    <p v-if="!semantic" class="state">
      Analyse pas encore calculée. Nécessite le service NLP local (<code>npm run dev:nlp</code>) —
      le premier calcul vectorise tous les paragraphes (plusieurs minutes) ; les suivants
      repartent du cache et ne recalculent que ce qui a changé.
    </p>

    <template v-else>
      <div class="semantic-picker">
        <label for="semantic-focus">Article :</label>
        <select id="semantic-focus" v-model="semanticFocusId">
          <option v-for="unit in semantic.units" :key="unit.nodeId" :value="unit.nodeId">
            {{ unit.titre }}
          </option>
        </select>
        <button v-if="focusUnit" type="button" class="open-node" @click="goToNode(focusUnit.nodeId)">
          Ouvrir <i class="pi pi-arrow-right"></i>
        </button>
      </div>

      <table v-if="focusUnit" class="data-table">
        <thead>
          <tr><th>Article proche</th><th class="score-col">Proximité</th></tr>
        </thead>
        <tbody>
          <tr
              v-for="neighbor in focusNeighbors"
              :key="neighbor.nodeId"
              class="word-node-row"
              title="Cliquer pour explorer cet article"
              @click="semanticFocusId = neighbor.nodeId"
          >
            <td>{{ neighbor.titre }}</td>
            <td class="score-col">
              <span class="score-bar-track">
                <span class="score-bar" :style="{ width: Math.max(0, neighbor.score * 100) + '%' }"></span>
              </span>
              <span class="score-value">{{ formatPercent(neighbor.score) }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <template v-if="duplicatePairs.length">
        <h3>Textes identiques ou quasi identiques</h3>
        <p class="hint">
          Ces articles partagent un texte (presque) mot pour mot — doublons ou refrains du manuscrit.
        </p>
        <table class="data-table">
          <tbody>
            <tr
                v-for="pair in duplicatePairs"
                :key="pair.key"
                class="word-node-row"
                @click="semanticFocusId = pair.a"
            >
              <td>{{ titreOf(pair.a) }}</td>
              <td>{{ titreOf(pair.b) }}</td>
              <td class="num">{{ formatPercent(pair.score) }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <h3>Paires d'articles les plus proches</h3>
      <table class="data-table">
        <tbody>
          <tr
              v-for="pair in topPairs"
              :key="pair.key"
              class="word-node-row"
              title="Cliquer pour explorer cette paire"
              @click="semanticFocusId = pair.a"
          >
            <td>{{ titreOf(pair.a) }}</td>
            <td>{{ titreOf(pair.b) }}</td>
            <td class="num">{{ formatPercent(pair.score) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </AnalyseCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AnalyseCard from './AnalyseCard.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { formatPercent } from '../../script/format'

const { analysis, running, stepErrors, goToNode } = useAnalyse()

const semanticFocusId = ref(null)

const semantic = computed(() => analysis.value?.semantic ?? null)

// Recale le focus quand l'analyse (re)charge ou que l'article visé disparaît.
watch(
  () => semantic.value?.units,
  (units) => {
    if (!units?.length) {
      semanticFocusId.value = null
    } else if (!units.some((u) => u.nodeId === semanticFocusId.value)) {
      semanticFocusId.value = units[0].nodeId
    }
  },
  { immediate: true },
)

const semanticTitreById = computed(
  () => new Map((semantic.value?.units ?? []).map((u) => [u.nodeId, u.titre])),
)

function titreOf(nodeId) {
  return semanticTitreById.value.get(nodeId) ?? '(sans titre)'
}

const focusUnit = computed(
  () => semantic.value?.units.find((u) => u.nodeId === semanticFocusId.value) ?? null,
)

const focusNeighbors = computed(
  () => focusUnit.value?.neighbors.map((n) => ({ ...n, titre: titreOf(n.nodeId) })) ?? [],
)

// Au-delà, deux articles partagent un texte identique ou quasi identique
// (doublons réels constatés dans le manuscrit : intros de blocs copiées) —
// information utile mais séparée, sinon elle sature le classement.
const DUPLICATE_THRESHOLD = 0.995

// Paires globales dédupliquées à partir des voisinages top-K (la matrice
// complète n'est pas persistée côté backend).
const allPairs = computed(() => {
  const byKey = new Map()
  for (const unit of semantic.value?.units ?? []) {
    for (const neighbor of unit.neighbors) {
      const key = [unit.nodeId, neighbor.nodeId].sort().join('|')
      const known = byKey.get(key)
      if (!known || known.score < neighbor.score) {
        byKey.set(key, { key, a: unit.nodeId, b: neighbor.nodeId, score: neighbor.score })
      }
    }
  }
  return Array.from(byKey.values()).sort((x, y) => y.score - x.score)
})

const duplicatePairs = computed(
  () => allPairs.value.filter((p) => p.score >= DUPLICATE_THRESHOLD).slice(0, 10),
)

const topPairs = computed(
  () => allPairs.value.filter((p) => p.score < DUPLICATE_THRESHOLD).slice(0, 15),
)
</script>

<style scoped>
.semantic-picker {
  display: flex;
  align-items: center;
  gap: 0.6em;
  margin: 0.5em 0 0.75em;
}

.semantic-picker select {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.35em 0.5em;
  border: 1px solid var(--c-border, #e0d8cc);
  border-radius: 4px;
  background: var(--c-surface, transparent);
  color: inherit;
  font: inherit;
}

.open-node {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.35em 0.7em;
  border: 1px solid var(--c-border, #e0d8cc);
  border-radius: 4px;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.85em;
}

.open-node:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}
</style>
