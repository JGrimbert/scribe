<template>
  <!-- Bloc-nuage : viz (2/3) à gauche, colonne étroite (1/3) à droite empilant
       les occurrences du mot sélectionné puis la proximité sémantique. Seul bloc
       sans `step` : son cadre est toujours monté et les trois cards se révèlent
       en chaîne dedans (elles ne dépendent pas toutes de la même analyse). -->
  <AnalyseBlock aside="right">
    <template #main>
      <Transition name="reveal" appear>
        <VocabulaireCloud v-if="isRevealed('cloud')" />
      </Transition>
    </template>

    <template #aside>
      <Transition name="reveal" appear>
        <OccurrencesCard v-if="isRevealed('occurrences')" />
      </Transition>
      <Transition name="reveal" appear>
        <SemantiqueCard v-if="isRevealed('semantique')" />
      </Transition>
    </template>
  </AnalyseBlock>
</template>

<script setup>
import AnalyseBlock from './AnalyseBlock.vue'
import VocabulaireCloud from './VocabulaireCloud.vue'
import OccurrencesCard from './OccurrencesCard.vue'
import SemantiqueCard from './SemantiqueCard.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { isRevealed } = useAnalyse()
</script>
