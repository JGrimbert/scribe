<template>
  <!-- Bloc anomalies : avancement de la rédaction (2/3) à gauche, les deux
       tables qui le détaillent (1/3) à droite. Les « chapitres en attente »
       sont dérivés du seul contenu (gratuit, toujours là) ; les « textes
       identiques » demandent le NLP et gèrent leur propre attente — d'où deux
       états d'affichage dans un seul bloc, plutôt qu'un bloc qui attendrait le
       NLP pour montrer un graphe déjà calculable. -->
  <AnalyseBlock
      step="completude"
      aside="right"
      :ready="!!distribution.length"
      unavailable="Aucun chapitre à situer dans ce document."
  >
    <template #main>
      <CompletenessChart />
    </template>

    <template #aside>
      <AnomaliesTable />
      <SemanticPairsCard
          bare
          title="Textes identiques ou quasi identiques"
          mode="duplicates"
          hint="Ces articles partagent un texte (presque) mot pour mot — doublons ou gabarits recopiés en attente de rédaction."
      />
    </template>
  </AnalyseBlock>
</template>

<script setup>
import { computed } from 'vue'
import AnalyseBlock from './AnalyseBlock.vue'
import AnomaliesTable from './AnomaliesTable.vue'
import CompletenessChart from './CompletenessChart.vue'
import SemanticPairsCard from './SemanticPairsCard.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { analysis } = useAnalyse()

const distribution = computed(() => analysis.value?.completeness?.distribution ?? [])
</script>
