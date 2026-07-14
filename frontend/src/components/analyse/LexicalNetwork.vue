<template>
  <svg
      class="viz"
      :class="{ 'has-focus': !!highlighted }"
      viewBox="0 0 640 440"
      role="img"
      aria-label="Réseau lexical de co-occurrences"
      @click="onBackground"
  >
    <line
        v-for="edge in network.edges"
        :key="edge.source + '|' + edge.target"
        :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"
        class="graph-edge"
        :class="{ inter: !edge.intra, lit: isEdgeLit(edge), dim: isEdgeDim(edge) }"
        :style="edge.intra ? { stroke: communityColor(edge.ca) } : null"
        :stroke-width="1 + edge.npmi * 2.5"
    />
    <g
        v-for="node in network.nodes"
        :key="node.lemma"
        class="graph-node"
        :class="{ lit: isLit(node.lemma), dim: isDim(node.lemma) }"
        @click.stop="selectNode(node.lemma)"
    >
      <circle :cx="node.x" :cy="node.y" :r="node.r" :style="{ fill: communityColor(node.community) }" />
      <text v-if="node.labelled" :x="node.x + node.r + 3" :y="node.y + 3">{{ node.lemma }}</text>
      <title>{{ node.lemma }} — présent dans {{ node.count }} phrases</title>
    </g>
  </svg>
</template>

<script setup>
import { useLexicalGraph } from '../../composables/useLexicalGraph'

const { network, highlighted, communityColor, selectNode, clear } = useLexicalGraph()

const isLit = (lemma) => highlighted.value?.has(lemma) ?? false
const isDim = (lemma) => !!highlighted.value && !highlighted.value.has(lemma)
// Une arête est allumée si ses deux extrémités le sont (ego-réseau d'un mot,
// ou intérieur d'une grappe) ; grisée dès qu'une extrémité ne l'est pas.
const isEdgeLit = (e) => !!highlighted.value && highlighted.value.has(e.source) && highlighted.value.has(e.target)
const isEdgeDim = (e) => !!highlighted.value && !(highlighted.value.has(e.source) && highlighted.value.has(e.target))

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

.graph-edge {
  stroke: var(--c-muted);
  stroke-opacity: 0.35;
  transition: stroke-opacity 0.2s ease;
}

.graph-edge.inter {
  stroke: var(--c-muted);
  stroke-opacity: 0.22;
}

.graph-node circle {
  fill-opacity: 0.9;
  cursor: pointer;
  transition: fill-opacity 0.2s ease;
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

/* Focus & context : le sélectionné et son voisinage ressortent, le reste
   s'estompe (brushing & linking). */
.has-focus .graph-edge:not(.lit) {
  stroke-opacity: 0.06;
}

.has-focus .graph-edge.lit {
  stroke-opacity: 0.85;
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
</style>
