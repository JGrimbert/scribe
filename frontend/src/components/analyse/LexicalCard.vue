<template>
  <UiCard title="" bare :busy="running === 'lexical'">
    <UiNote v-if="stepErrors.lexical" variant="error">{{ stepErrors.lexical }}</UiNote>
    <template v-if="!lexical && running !== 'lexical'">
      <UiNote>
        Analyse pas encore calculée. Nécessite le service NLP local (<code>npm run dev:nlp</code>) —
        le calcul peut prendre quelques minutes sur un manuscrit complet.
      </UiNote>
      <BaseButton variant="outline" icon="pi-play" :busy="!!running" class="run-step" @click="runStep('lexical')">
        Lancer l'analyse linguistique
      </BaseButton>
    </template>

    <template v-else>
      <template v-if="network">
        <div class="lex-row">
          <div class="lex-row__side">
            <NodeInspector />
            <LexicalFields />
            <BridgeWords />
          </div>
          <div class="lex-row__net">
            <LexicalNetwork />
          </div>
        </div>
      </template>
      <UiNote v-else-if="lexical && !lexical.graph" variant="hint">
        Réseau lexical indisponible sur cette analyse — relancer l'analyse pour l'obtenir.
      </UiNote>
    </template>
  </UiCard>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import UiHint from '../ui/UiHint.vue'
import BaseButton from '../ui/BaseButton.vue'
import NodeInspector from './NodeInspector.vue'
import LexicalFields from './LexicalFields.vue'
import BridgeWords from './BridgeWords.vue'
import LexicalNetwork from './LexicalNetwork.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { provideLexicalGraph } from '../../composables/useLexicalGraph'

const { analysis, running, stepErrors, settle, runStep } = useAnalyse()

onMounted(() => settle('lexical'))

const lexical = computed(() => analysis.value?.lexical ?? null)
const { network, threshold } = provideLexicalGraph(lexical)

</script>

<style scoped>
.run-step {
  margin-top: 0.75em;
}
/* Colonne de modules (1/3) à gauche, réseau (2/3) à droite — inverse du bloc
   nuage. Séparateur vertical à la bordure. */
.lex-row {
  display: flex;
  align-items: stretch;
  /*margin-top: 0.5em;*/
}

.lex-row__side {
  flex: 1 1 0;
  min-width: 0;
  padding-right: 1.1em;
}

.lex-row__net {
  flex: 2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: 1.1em;
  border-left: 1px solid var(--c-border);
}

.legend-swatches i {
  width: 0.6em;
  height: 0.85em;
  border-radius: 2px;
}

</style>
