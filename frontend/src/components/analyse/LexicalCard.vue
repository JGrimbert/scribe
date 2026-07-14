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
            <span class="lex-threshold__name">Force min. <UiHint :text="HINTS.npmi" /></span>
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
            <div class="lex-legend">
              <span class="legend-item">
                <span class="legend-dot"></span>
                <span><b>Nœud</b> : un nom du texte, taille selon la fréquence</span>
                <UiHint :text="HINTS.node" />
              </span>
              <span class="legend-item">
                <span class="legend-line"></span>
                <span><b>Lien</b> : co-occurrence en phrase, épaisseur selon la force</span>
                <UiHint :text="HINTS.edge" />
              </span>
              <span class="legend-item">
                <span class="legend-swatches">
                  <i style="background: var(--c-cat-1)"></i>
                  <i style="background: var(--c-cat-2)"></i>
                  <i style="background: var(--c-cat-3)"></i>
                </span>
                <span>Couleur : <b>champ lexical</b></span>
                <UiHint :text="HINTS.field" />
              </span>
            </div>
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
const { network, threshold, npmiExtent, visibleEdges } = provideLexicalGraph(lexical)

const fmtNpmi = (v) => v.toFixed(2).replace('.', ',')

const HINTS = {
  npmi:
    'NPMI (information mutuelle ponctuelle normalisée) : mesure à quel point deux mots ' +
    'apparaissent ensemble plus que le hasard ne le voudrait. De 0 à 1 — plus c’est élevé, ' +
    'plus l’association est spécifique. Le curseur masque les liens sous le seuil.',
  node: 'Un nom (substantif ou nom propre) du texte. Sa taille suit sa fréquence, sa couleur son champ lexical.',
  edge:
    'Deux noms présents dans une même phrase (co-occurrence). L’épaisseur suit la force ' +
    'd’association (NPMI) ; les liens entre champs différents sont grisés.',
  field:
    'Grappe de mots qui co-occurrent densément entre eux (détection de communautés). ' +
    'Chaque couleur en marque un — souvent un thème ou un registre du texte.',
}
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
  flex-direction: column;
  justify-content: center;
  padding-left: 1.1em;
  border-left: 1px solid var(--c-border);
}

/* Légende ferrée sous le graphe : ce que sont nœuds, liens, couleurs. */
.lex-legend {
  display: flex;
  flex-direction: column;
  gap: 0.35em;
  margin-top: 0.5em;
  padding-top: 0.6em;
  border-top: 1px solid var(--c-border);
  font-size: var(--fs-sm);
  opacity: var(--op-soft);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.legend-dot {
  width: 0.85em;
  height: 0.85em;
  border-radius: var(--radius-pill);
  background: var(--c-cat-1);
  flex-shrink: 0;
}

.legend-line {
  width: 1.4em;
  height: 0;
  border-top: 3px solid var(--c-muted);
  flex-shrink: 0;
}

.legend-swatches {
  display: inline-flex;
  gap: 2px;
  flex-shrink: 0;
}

.legend-swatches i {
  width: 0.6em;
  height: 0.85em;
  border-radius: 2px;
}

.lex-threshold__name {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
}
</style>
