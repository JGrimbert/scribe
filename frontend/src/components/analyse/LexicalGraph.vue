<template>
  <svg
      class="viz"
      :class="{ 'has-focus': !!highlighted }"
      viewBox="0 0 640 440"
      role="img"
      aria-label="Réseau lexical de co-occurrences"
      @click="onBackground"
  >
    <defs>
      <filter id="lex-shadow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="2.4" />
      </filter>
    </defs>

    <!-- 1. Arêtes en z-order (betweenness) avec casing : halo couleur-papier
         sous le cœur coloré → l'arête du dessus creuse celle du dessous. Le
         halo est coupé sur les arêtes grisées quand un focus est actif. -->
    <g class="edges">
      <template v-for="edge in orderedEdges" :key="edge.source + '|' + edge.target">
        <line
            v-if="showHalo(edge)"
            class="edge-halo"
            :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"
            :stroke-width="coreWidth(edge) + 2.2"
        />
        <line
            :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"
            class="graph-edge"
            :class="{ inter: !edge.intra, lit: isEdgeLit(edge) }"
            :style="edge.intra ? { stroke: communityColor(edge.ca) } : null"
            :stroke-width="coreWidth(edge)"
        />
      </template>
    </g>

    <!-- 2. Ombres portées : profondeur pilotée par la betweenness (les nœuds
         les plus centraux flottent plus haut). Coupées sur le grisé. -->
    <g class="shadows">
      <ellipse
          v-for="node in shadowNodes"
          :key="node.lemma"
          :cx="node.x"
          :cy="node.y + node.r + shadowGap(node)"
          :rx="node.r * 0.85"
          :ry="node.r * 0.3"
          :opacity="shadowOpacity(node)"
          filter="url(#lex-shadow)"
      />
    </g>

    <!-- 3. Nœuds en z-order, avec rehaut sphérique. -->
    <g class="nodes">
      <g
          v-for="node in orderedNodes"
          :key="node.lemma"
          class="graph-node"
          :class="{ lit: isLit(node.lemma), dim: isDim(node.lemma), faded: isFaded(node.lemma) }"
          @click.stop="selectNode(node.lemma)"
      >
        <circle :cx="node.x" :cy="node.y" :r="node.r" :style="{ fill: communityColor(node.community) }" />
        <circle
            v-if="showGloss(node)"
            class="node-gloss"
            :cx="node.x - node.r * 0.3"
            :cy="node.y - node.r * 0.3"
            :r="node.r * 0.42"
        />
        <text v-if="node.labelled" :x="node.x + node.r + 3" :y="node.y + 3">{{ node.lemma }}</text>
        <title>{{ node.lemma }} — présent dans {{ node.count }} phrases</title>
      </g>
    </g>
  </svg>
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
</template>

<script setup>
import { computed } from 'vue'
import { useLexicalGraph } from '../../composables/useLexicalGraph'
import UiHint from "../ui/UiHint.vue";

const { network, highlighted, visibleEdges, connectedLemmas, communityColor, selectNode, clear, threshold, npmiExtent } =
  useLexicalGraph()

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

const isLit = (lemma) => highlighted.value?.has(lemma) ?? false
const isDim = (lemma) => !!highlighted.value && !highlighted.value.has(lemma)
// Estompé : plus aucun lien visible au seuil NPMI courant (contexte).
const isConnected = (lemma) => connectedLemmas.value.has(lemma)
const isFaded = (lemma) => !isConnected(lemma)
// Une arête est allumée si ses deux extrémités le sont (ego-réseau d'un mot,
// ou intérieur d'une grappe) ; grisée dès qu'une extrémité ne l'est pas.
const isEdgeLit = (e) => !!highlighted.value && highlighted.value.has(e.source) && highlighted.value.has(e.target)

// Betweenness par lemme → profondeur (z) des arêtes et des nœuds.
const centralityOf = computed(
  () => new Map((network.value?.nodes ?? []).map((n) => [n.lemma, n.centrality])),
)
const edgeZ = (e) =>
  Math.max(centralityOf.value.get(e.source) ?? 0, centralityOf.value.get(e.target) ?? 0)

// Ordre de dessin = (grisé avant allumé) puis z croissant. Sans focus, tout est
// "non allumé" → pur z. Avec focus, l'ego-réseau passe toujours au premier plan.
const litRank = (lit) => (lit ? 1 : 0)
const orderedEdges = computed(() =>
  visibleEdges.value
    .slice()
    .sort(
      (a, b) =>
        litRank(isEdgeLit(a)) - litRank(isEdgeLit(b)) || edgeZ(a) - edgeZ(b) || a.npmi - b.npmi,
    ),
)
const orderedNodes = computed(() =>
  (network.value?.nodes ?? [])
    .slice()
    .sort(
      (a, b) =>
        litRank(isLit(a.lemma)) - litRank(isLit(b.lemma)) || a.centrality - b.centrality,
    ),
)

const coreWidth = (e) => 1 + e.npmi * 2.5

// « Actif » = connecté au seuil courant ET (pas de focus, ou allumé). Le relief
// (halo, ombre, rehaut) n'est porté que par les éléments actifs → le fond grisé
// comme les nœuds isolés s'aplatissent.
const isActive = (lemma) => isConnected(lemma) && (!highlighted.value || highlighted.value.has(lemma))
const showHalo = (e) => !highlighted.value || isEdgeLit(e)
const showGloss = (node) => isActive(node.lemma) && node.r > 6

const shadowNodes = computed(() => orderedNodes.value.filter((n) => isActive(n.lemma)))
const shadowGap = (node) => 1.5 + node.centrality * 3.5
const shadowOpacity = (node) => 0.1 + node.centrality * 0.16

// Clic dans le vide (hors nœud) : on déselectionne.
const onBackground = () => clear()
</script>

<style scoped>
.viz {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.edge-halo {
  stroke: var(--c-paper);
  stroke-opacity: 0.9;
  stroke-linecap: round;
}

.graph-edge {
  stroke: var(--c-muted);
  stroke-opacity: 0.4;
  stroke-linecap: round;
  transition: stroke-opacity 0.2s ease;
}

.graph-edge.inter {
  stroke: var(--c-muted);
  stroke-opacity: 0.25;
}

.shadows ellipse {
  fill: #4a3016;
}

.graph-node circle {
  fill-opacity: 0.92;
  cursor: pointer;
  transition: fill-opacity 0.2s ease;
}

.node-gloss {
  fill: #fff;
  opacity: 0.22;
  pointer-events: none;
}

.graph-node text {
  font-size: 10px;
  fill: var(--c-ink2);
  font-family: var(--font-ui);
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.75);
  stroke-width: 2.5px;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

/* Focus & context : le voisinage ressort, le reste s'estompe (et s'aplatit —
   halos/ombres coupés côté script). */
.has-focus .graph-edge:not(.lit) {
  stroke-opacity: 0.06;
}

.has-focus .graph-edge.lit {
  stroke-opacity: 0.9;
}

.graph-node.dim circle {
  fill-opacity: 0.18;
}

.graph-node.dim text {
  opacity: 0.15;
}

.graph-node.lit circle {
  fill-opacity: 1;
}

/* Nœud isolé au seuil courant : simple repère de contexte, sans relief. */
.graph-node.faded circle {
  fill-opacity: 0.15;
}

.graph-node.faded text {
  opacity: 0;
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

.lex-threshold__name {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
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

</style>
