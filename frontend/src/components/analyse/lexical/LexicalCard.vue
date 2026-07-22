<template>
  <!-- Bloc lexical : colonne de modules (1/3) à gauche, réseau (2/3) à droite —
       inverse du bloc-nuage. -->
  <AnalyseBlock
      step="lexical"
      aside="left"
      :ready="!!network"
      run-label="Lancer l'analyse linguistique"
      run-hint="le calcul peut prendre quelques minutes sur un manuscrit complet."
      unavailable="Réseau lexical indisponible sur cette analyse — relancer l'analyse pour l'obtenir."
  >
    <template #aside>
      <NodeInspector />
      <LexicalFields />
      <BridgeWords />
    </template>

    <template #main>
      <LexicalGraph />
    </template>
  </AnalyseBlock>
</template>

<script setup>
import { computed } from 'vue'
import AnalyseBlock from '../AnalyseBlock.vue'
import NodeInspector from '../semantic/NodeInspector.vue'
import LexicalFields from './LexicalFields.vue'
import BridgeWords from './BridgeWords.vue'
import LexicalGraph from './LexicalGraph.vue'
import { useAnalyse } from '../../../composables/useAnalyse'
import { provideLexicalGraph } from '../../../composables/useLexicalGraph'

const { analysis } = useAnalyse()

const lexical = computed(() => analysis.value?.lexical ?? null)
const { network } = provideLexicalGraph(lexical)
</script>
