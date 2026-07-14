<template>
  <UiCard title="Chapitres en attente" wide>
    <UiNote variant="hint">
      Chapitres au contenu insuffisant (moins de {{ threshold }} mots de texte propre) — sans doute
      non rédigés ou réduits à un titre. Exclus de l'analyse thématique ; à rapprocher des
      « Textes identiques » (gabarits recopiés en attente de rédaction).
    </UiNote>

    <template v-if="anomalies.length">
      <UiNote>{{ anomalies.length }} chapitre(s) sur {{ leafCount }}.</UiNote>
      <UiTable>
        <thead>
          <tr>
            <th>Chapitre</th>
            <th class="num">mots</th>
            <th>état</th>
          </tr>
        </thead>
        <tbody>
          <tr
              v-for="a in anomalies"
              :key="a.nodeId"
              class="row-link"
              title="Ouvrir le chapitre"
              @click="goToNode(a.nodeId)"
          >
            <td>{{ a.titre }}</td>
            <td class="num">{{ a.words }}</td>
            <td>{{ a.status }}</td>
          </tr>
        </tbody>
      </UiTable>
    </template>
    <UiNote v-else variant="hint">Aucun chapitre en attente détecté.</UiNote>
  </UiCard>
</template>

<script setup>
import { computed } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import UiTable from '../ui/UiTable.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { analysis, goToNode } = useAnalyse()

const completeness = computed(() => analysis.value?.completeness ?? null)
const threshold = computed(() => completeness.value?.threshold ?? 50)
const leafCount = computed(() => completeness.value?.leafCount ?? 0)
const anomalies = computed(() => completeness.value?.anomalies ?? [])
</script>
