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
      <!-- La conformité ne s'affiche que si la typologie est arbitrée : sans
           elle, « sans annotation » ne repose sur rien (le renvoi vers la
           configuration prend alors sa place, dans la colonne). -->
      <ConformityChart v-if="conformityAvailable" class="conformity-block" />
    </template>

    <template #aside>
      <UiCard v-if="!typologySettled" bare>
        <UiNote variant="hint">
          Les styles de ce document ne sont pas encore typés : impossible de dire ce qu'un chapitre
          doit contenir pour être validable.
          <!-- Chemin littéral et non route nommée : le routeur en mémoire des
               stories est un attrape-tout, sans noms (cf. .storybook/preview.js). -->
          <RouterLink :to="`/documents/${route.params.id}/config?volet=styles`">
            Configurer la typologie
          </RouterLink>
        </UiNote>
      </UiCard>

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
import { computed, inject, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AnalyseBlock from './AnalyseBlock.vue'
import AnomaliesTable from './AnomaliesTable.vue'
import CompletenessChart from './CompletenessChart.vue'
import ConformityChart from './ConformityChart.vue'
import SemanticPairsCard from './SemanticPairsCard.vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const route = useRoute()
const { analysis } = useAnalyse()

// Fourni par DocumentLayout ; `true` par défaut pour les stories, qui montent
// le bloc sans le layout et n'ont pas à afficher un renvoi hors sujet.
const typologySettled = inject('typologySettled', ref(true))

const distribution = computed(() => analysis.value?.completeness?.distribution ?? [])

// `available` vient du backend : il refuse de juger tant que la typologie
// n'est pas arbitrée. On ne double pas cette décision côté client.
const conformityAvailable = computed(
  () => !!analysis.value?.conformity?.available && !!analysis.value.conformity.criteria.length,
)
</script>

<style scoped>
.conformity-block {
  margin-top: var(--sp-6);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-border);
}
</style>
