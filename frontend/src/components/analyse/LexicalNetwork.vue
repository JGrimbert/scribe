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
</template>

<script setup>
import { computed } from 'vue'
import { useLexicalGraph } from '../../composables/useLexicalGraph'

const { network, highlighted, visibleEdges, connectedLemmas, communityColor, selectNode, clear } =
  useLexicalGraph()

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
</style>
