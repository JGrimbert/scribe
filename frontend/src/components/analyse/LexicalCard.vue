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
      <template v-if="lexical.graph && graphLayout">
        <h3>Réseau lexical</h3>
        <UiNote variant="hint">
          Noms co-présents dans une même phrase — la taille suit la fréquence, l'épaisseur du
          lien la force d'association (NPMI). Survoler un mot pour son compte exact.
        </UiNote>
        <svg class="viz" viewBox="0 0 640 440" role="img" aria-label="Réseau lexical de co-occurrences">
          <line
              v-for="edge in graphLayout.edges"
              :key="edge.source + '|' + edge.target"
              :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"
              class="graph-edge"
              :stroke-width="1 + edge.npmi * 2.5"
              :stroke-opacity="0.25 + edge.npmi * 0.45"
          />
          <g v-for="node in graphLayout.nodes" :key="node.lemma" class="graph-node">
            <circle :cx="node.x" :cy="node.y" :r="node.r" />
            <text v-if="node.labelled" :x="node.x + node.r + 3" :y="node.y + 3">{{ node.lemma }}</text>
            <title>{{ node.lemma }} — présent dans {{ node.count }} phrases</title>
          </g>
        </svg>
      </template>
      <UiNote v-else-if="!lexical.graph" variant="hint">
        Réseau lexical indisponible sur cette analyse — relancer l'analyse pour l'obtenir.
      </UiNote>

      <h3>Par article</h3>
      <UiTable scroll>
        <thead>
          <tr>
            <th>Article</th>
            <th class="num">Phrases</th>
            <th class="num">Mots</th>
            <th class="num">Mots / phrase</th>
            <th class="num">Diversité (TTR)</th>
            <th class="num">Densité lexicale</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="unit in lexical.units" :key="unit.nodeId" class="row-link" @click="goToNode(unit.nodeId)">
            <td>{{ unit.titre }}</td>
            <td class="num">{{ formatInt(unit.sentences) }}</td>
            <td class="num">{{ formatInt(unit.words) }}</td>
            <td class="num">{{ unit.avgSentenceLength.toLocaleString('fr') }}</td>
            <td class="num">{{ formatPercent(unit.ttr) }}</td>
            <td class="num">{{ formatPercent(unit.lexicalDensity) }}</td>
          </tr>
        </tbody>
      </UiTable>
    </template>
  </UiCard>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import UiTable from '../ui/UiTable.vue'
import BaseButton from '../ui/BaseButton.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { formatInt, formatPercent } from '../../script/format'
import { loadLayout, saveLayout, signature } from '../../script/layoutCache'

const route = useRoute()
const { analysis, running, stepErrors, goToNode, settle, runStep } = useAnalyse()

onMounted(() => settle('lexical'))

const lexical = computed(() => analysis.value?.lexical ?? null)

// ── Réseau lexical ──
const GRAPH_W = 640
const GRAPH_H = 440

// Layout force maison, déterministe (positions initiales en cercle, pas
// d'aléatoire) : ~50 nœuds, pas de quoi embarquer d3-force.
function layoutGraph(graph) {
  const nodes = graph.nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / graph.nodes.length
    return {
      ...n,
      x: GRAPH_W / 2 + Math.cos(angle) * GRAPH_W * 0.35,
      y: GRAPH_H / 2 + Math.sin(angle) * GRAPH_H * 0.35,
    }
  })
  const indexOf = new Map(nodes.map((n, i) => [n.lemma, i]))
  const edges = graph.edges
    .map((e) => ({ ...e, a: indexOf.get(e.source), b: indexOf.get(e.target) }))
    .filter((e) => e.a !== undefined && e.b !== undefined)

  const ITERATIONS = 260
  const REPULSION = 5200
  const SPRING = 0.025
  const SPRING_LENGTH = 80
  for (let it = 0; it < ITERATIONS; it++) {
    const cool = 1 - it / ITERATIONS
    const fx = new Array(nodes.length).fill(0)
    const fy = new Array(nodes.length).fill(0)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const d2 = Math.max(dx * dx + dy * dy, 40)
        const f = REPULSION / d2
        const d = Math.sqrt(d2)
        fx[i] += (dx / d) * f; fy[i] += (dy / d) * f
        fx[j] -= (dx / d) * f; fy[j] -= (dy / d) * f
      }
    }
    for (const e of edges) {
      const dx = nodes[e.b].x - nodes[e.a].x
      const dy = nodes[e.b].y - nodes[e.a].y
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const f = SPRING * (d - SPRING_LENGTH) * (0.5 + e.npmi)
      fx[e.a] += (dx / d) * f; fy[e.a] += (dy / d) * f
      fx[e.b] -= (dx / d) * f; fy[e.b] -= (dy / d) * f
    }
    for (let i = 0; i < nodes.length; i++) {
      fx[i] += (GRAPH_W / 2 - nodes[i].x) * 0.012
      fy[i] += (GRAPH_H / 2 - nodes[i].y) * 0.012
      nodes[i].x = Math.min(GRAPH_W - 60, Math.max(14, nodes[i].x + fx[i] * cool))
      nodes[i].y = Math.min(GRAPH_H - 14, Math.max(14, nodes[i].y + fy[i] * cool))
    }
  }

  const maxCount = Math.max(...nodes.map((n) => n.count), 1)
  const labelThreshold = [...nodes.map((n) => n.count)].sort((a, b) => b - a)[29] ?? 0
  for (const node of nodes) {
    node.r = 3.5 + Math.sqrt(node.count / maxCount) * 9
    node.x = Math.round(node.x * 10) / 10
    node.y = Math.round(node.y * 10) / 10
    node.labelled = node.count >= labelThreshold
  }
  return {
    nodes,
    edges: edges.map((e) => ({
      ...e,
      x1: nodes[e.a].x, y1: nodes[e.a].y, x2: nodes[e.b].x, y2: nodes[e.b].y,
    })),
  }
}

// Layout de force déterministe mais coûteux (260 itérations O(n²)) : caché par
// signature du graphe pour ne pas le recalculer à chaque montage.
const graphLayout = computed(() => {
  const graph = lexical.value?.graph
  if (!graph?.nodes?.length) return null
  const sig = signature(
    graph.nodes.map((n) => `${n.lemma}:${n.count}`).join('|') +
      '#' +
      graph.edges.map((e) => `${e.source}-${e.target}:${e.npmi}`).join('|'),
  )
  const cached = loadLayout('graph', route.params.id, sig)
  if (cached) return cached
  const out = layoutGraph(graph)
  saveLayout('graph', route.params.id, sig, out)
  return out
})
</script>

<style scoped>
.run-step {
  margin-top: 0.75em;
}

.graph-edge {
  stroke: #a8946f;
}

.graph-node circle {
  fill: var(--c-accent);
  fill-opacity: 0.85;
}

.graph-node text {
  font-size: 10px;
  fill: var(--c-ink2);
  font-family: var(--font-ui);
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.75);
  stroke-width: 2.5px;
}
</style>
