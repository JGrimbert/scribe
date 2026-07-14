<template>
  <UiCard v-if="units.length" title="Statistiques par article">
    <UiTable scroll>
      <thead>
        <tr>
          <th>Article</th>
          <th class="num">Phrases</th>
          <th class="num">Mots</th>
          <th class="num">Mots / phrase</th>
          <th class="num">Diversité (TTR)</th>
          <th class="num">Densité lexicale</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="unit in units" :key="unit.nodeId" class="row-link" @click="goToNode(unit.nodeId)">
          <td>{{ unit.titre }}</td>
          <td class="num">{{ formatInt(unit.sentences) }}</td>
          <td class="num">{{ formatInt(unit.words) }}</td>
          <td class="num">{{ unit.avgSentenceLength.toLocaleString('fr') }}</td>
          <td class="num">{{ formatPercent(unit.ttr) }}</td>
          <td class="num">{{ formatPercent(unit.lexicalDensity) }}</td>
        </tr>
      </tbody>
    </UiTable>
  </UiCard>
</template>

<script setup>
import { computed } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiTable from '../ui/UiTable.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { formatInt, formatPercent } from '../../script/format'

const { analysis, goToNode } = useAnalyse()

const units = computed(() => analysis.value?.lexical?.units ?? [])
</script>
