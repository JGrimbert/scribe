<template>
  <UiCard title="Analyse linguistique" wide :busy="running === 'lexical'">
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
        <div class="lex-head">
          <h3>Réseau lexical</h3>
          <label v-if="npmiExtent && npmiExtent.max > npmiExtent.min" class="lex-threshold">
            <span>Force min.</span>
            <input
                type="range"
                :min="npmiExtent.min"
                :max="npmiExtent.max"
                step="0.01"
                :value="threshold"
                @input="threshold = Number($event.target.value)"
            />
            <span class="lex-threshold__val">{{ fmtNpmi(threshold) }} · {{ visibleEdges.length }} liens</span>
          </label>
        </div>
        <UiNote variant="hint">
          Noms co-présents dans une même phrase — la couleur marque le champ lexical (grappe),
          la taille suit la fréquence, l'épaisseur du lien la force d'association (NPMI).
          Cliquez un mot ou un champ pour isoler son réseau.
        </UiNote>
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
const { network, threshold, npmiExtent, visibleEdges } = provideLexicalGraph(lexical)

const fmtNpmi = (v) => v.toFixed(2).replace('.', ',')
</script>

<style scoped>
.run-step {
  margin-top: 0.75em;
}

/* En-tête du réseau : titre à gauche, curseur de seuil NPMI à droite. */
.lex-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1em;
  flex-wrap: wrap;
}

.lex-threshold {
  display: inline-flex;
  align-items: center;
  gap: 0.6em;
  font-size: var(--fs-sm);
  opacity: 0.85;
}

.lex-threshold input[type='range'] {
  width: 8em;
  accent-color: var(--c-accent);
  cursor: pointer;
}

.lex-threshold__val {
  font-variant-numeric: tabular-nums;
  opacity: var(--op-muted);
  min-width: 5.5em;
}

/* Colonne de modules (1/3) à gauche, réseau (2/3) à droite — inverse du bloc
   nuage. Séparateur vertical à la bordure. */
.lex-row {
  display: flex;
  align-items: stretch;
  margin-top: 0.5em;
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
  align-items: center;
  padding-left: 1.1em;
  border-left: 1px solid var(--c-border);
}
</style>
