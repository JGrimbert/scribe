<template>
  <!-- Bloc-nuage : viz (2/3) à gauche, colonne étroite (1/3) à droite empilant
       les occurrences du mot sélectionné puis la proximité sémantique. Le cadre
       est toujours présent ; les trois cards se révèlent en chaîne dedans. -->
  <div class="split">
    <Transition name="reveal" appear>
      <VocabulaireCloud v-if="isRevealed('cloud')" class="split-main" />
    </Transition>
    <div class="split-right">
      <Transition name="reveal" appear>
        <OccurrencesCard v-if="isRevealed('occurrences')" />
      </Transition>
      <Transition name="reveal" appear>
        <SemantiqueCard v-if="isRevealed('semantique')" />
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { useAnalyse } from '../../composables/useAnalyse'
import VocabulaireCloud from './VocabulaireCloud.vue'
import OccurrencesCard from './OccurrencesCard.vue'
import SemantiqueCard from './SemantiqueCard.vue'

const { isRevealed } = useAnalyse()
</script>
