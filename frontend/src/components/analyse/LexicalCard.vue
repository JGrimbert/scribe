<template>
  <!-- Bloc lexical : colonne de modules (1/3) à gauche, réseau (2/3) à droite —
       inverse du bloc-nuage. Le cadre et son contenu se révèlent d'un bloc. -->
  <Transition name="reveal" appear>
    <div v-if="isRevealed('lexical')" class="split">
      <i v-if="running === 'lexical'" class="pi pi-spin pi-spinner lex-busy"></i>

      <!-- Réseau absent : message pleine largeur (pas de colonnes). -->
      <div v-if="!network" class="lex-message">
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
        <UiNote v-else-if="lexical && !lexical.graph" variant="hint">
          Réseau lexical indisponible sur cette analyse — relancer l'analyse pour l'obtenir.
        </UiNote>
      </div>

      <template v-else>
        <div class="split-left">
          <NodeInspector />
          <LexicalFields />
          <BridgeWords />
        </div>
        <div class="split-main">
          <LexicalGraph />
        </div>
      </template>
    </div>
  </Transition>
</template>

<script setup>
import { computed, watch } from 'vue'
import UiNote from '../ui/UiNote.vue'
import BaseButton from '../ui/BaseButton.vue'
import NodeInspector from './NodeInspector.vue'
import LexicalFields from './LexicalFields.vue'
import BridgeWords from './BridgeWords.vue'
import LexicalGraph from './LexicalGraph.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { provideLexicalGraph } from '../../composables/useLexicalGraph'

const { analysis, running, stepErrors, isRevealed, settle, runStep } = useAnalyse()

const lexical = computed(() => analysis.value?.lexical ?? null)
const { network } = provideLexicalGraph(lexical)

// Le composant est monté d'emblée (cadre symétrique du bloc-nuage) ; on relaie
// à la chaîne de révélation au moment où le contenu apparaît, pas au montage.
watch(() => isRevealed('lexical'), (revealed) => { if (revealed) settle('lexical') }, { immediate: true })
</script>

<style scoped>
.split {
  position: relative;
}

/* Réseau centré verticalement dans sa respiration (--split-pad, global). */
.split-main {
  justify-content: center;
}

.lex-message {
  flex: 1;
  padding: var(--split-pad);
}

.lex-busy {
  position: absolute;
  top: 0.7em;
  right: 0.9em;
  font-size: 0.85em;
  color: var(--c-accent);
}

.run-step {
  margin-top: 0.75em;
}
</style>
