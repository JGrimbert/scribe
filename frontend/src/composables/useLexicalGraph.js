import { computed, inject, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { loadLayout, saveLayout, signature } from '../script/layoutCache'
import { detectCommunities, betweenness } from '../script/graphMetrics'
import { buildWordIndex, resolveSelection } from '../script/lexicalSelection'
import { buildCloudWords } from '../script/cloudCategories'
import { useAnalyse } from './useAnalyse'

const KEY = Symbol('lexical-graph')

const GRAPH_W = 640
const GRAPH_H = 440

// Palette catégorielle (tokens base.css), cyclée au-delà de 8 grappes.
const CAT_COUNT = 8
export const communityColor = (id) => `var(--c-cat-${(id % CAT_COUNT) + 1})`

// Layout force maison déterministe (positions initiales en cercle, groupées par
// communauté pour que les grappes se séparent) + métriques attachées à chaque
// nœud. Coûteux (260 itérations O(n²)) mais caché par signature du graphe.
function buildNetwork(graph) {
  const community = detectCommunities(graph.nodes, graph.edges)
  const centrality = betweenness(graph.nodes, graph.edges)

  // Départ groupé par communauté : les nœuds d'une même grappe démarrent dans
  // le même secteur angulaire → la force les agrège au lieu de les éparpiller.
  const order = graph.nodes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => community[a.n.lemma] - community[b.n.lemma] || a.i - b.i)
  const angleOf = new Map()
  order.forEach(({ n }, k) => {
    angleOf.set(n.lemma, (2 * Math.PI * k) / graph.nodes.length)
  })

  const nodes = graph.nodes.map((n) => {
    const angle = angleOf.get(n.lemma)
    return {
      ...n,
      community: community[n.lemma],
      centrality: centrality[n.lemma],
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
      source: e.source,
      target: e.target,
      npmi: e.npmi,
      count: e.count,
      ca: nodes[e.a].community,
      cb: nodes[e.b].community,
      intra: nodes[e.a].community === nodes[e.b].community,
      x1: nodes[e.a].x, y1: nodes[e.a].y, x2: nodes[e.b].x, y2: nodes[e.b].y,
    })),
  }
}

export function provideLexicalGraph(lexical) {
  const route = useRoute()

  // La sélection d'un NŒUD est déléguée au store d'analyse (selectedLemma) :
  // cliquer un nœud pilote aussi Occurrences/Proximité, et un mot choisi dans
  // le nuage surligne son nœud ici. La sélection d'une COMMUNAUTÉ reste locale
  // (pas de mot unique à propager). `focus` en dérive — pas de watcher croisé,
  // donc pas de boucle.
  const { selectedLemma } = useAnalyse()
  const selectedCommunity = ref(null) // id de grappe surlignée, ou null

  // Focus courant : nœud (mot partagé), communauté (grappe locale), ou rien.
  // selectedLemma peut porter la casse d'un nom propre (« Margot ») ; on
  // retrouve le nœud du graphe (« margot ») sans faute de casse.
  const focus = computed(() => {
    if (selectedCommunity.value != null) return { kind: 'community', id: selectedCommunity.value }
    const sel = selectedLemma.value?.lemma
    const graphLemma = sel ? nodeKeyLower.value.get(sel.toLowerCase()) : undefined
    return graphLemma ? { kind: 'node', lemma: graphLemma } : null
  })

  // Seuil de force d'association (NPMI) : déclutter purement visuel. Le layout,
  // les communautés et la betweenness restent calculés sur le graphe complet —
  // on ne masque que des arêtes, sans jamais recalculer les positions.
  const threshold = ref(0)

  const network = computed(() => {
    const graph = lexical.value?.graph
    if (!graph?.nodes?.length) return null
    const sig = signature(
      graph.nodes.map((n) => `${n.lemma}:${n.count}`).join('|') +
        '#' +
        graph.edges.map((e) => `${e.source}-${e.target}:${e.npmi}`).join('|'),
    )
    const cached = loadLayout('lexnet', route.params.id, sig)
    if (cached) return cached
    const out = buildNetwork(graph)
    saveLayout('lexnet', route.params.id, sig, out)
    return out
  })

  const npmiExtent = computed(() => {
    const edges = network.value?.edges ?? []
    if (!edges.length) return null
    let min = Infinity
    let max = -Infinity
    for (const e of edges) {
      if (e.npmi < min) min = e.npmi
      if (e.npmi > max) max = e.npmi
    }
    return { min, max }
  })

  // Nouveau document → seuil réinitialisé au minimum (tout visible).
  watch(npmiExtent, (ext) => { threshold.value = ext ? ext.min : 0 }, { immediate: true })

  const visibleEdges = computed(() =>
    (network.value?.edges ?? []).filter((e) => e.npmi >= threshold.value),
  )
  // Lemmes gardant au moins un lien visible au seuil courant : les autres sont
  // estompés (contexte), jamais retirés — la carte reste stable.
  const connectedLemmas = computed(() => {
    const set = new Set()
    for (const e of visibleEdges.value) {
      set.add(e.source)
      set.add(e.target)
    }
    return set
  })

  // Adjacence lemme → arêtes incidentes (pour voisinage + associations triées).
  const adjacency = computed(() => {
    const map = new Map()
    for (const e of network.value?.edges ?? []) {
      if (!map.has(e.source)) map.set(e.source, [])
      if (!map.has(e.target)) map.set(e.target, [])
      map.get(e.source).push({ lemma: e.target, npmi: e.npmi, count: e.count })
      map.get(e.target).push({ lemma: e.source, npmi: e.npmi, count: e.count })
    }
    return map
  })

  // Ensemble des lemmes mis en avant par le focus courant, ou null (pas de
  // grisage). Nœud → lui + ses voisins directs ; communauté → tous ses membres.
  const highlighted = computed(() => {
    const f = focus.value
    if (!f) return null
    if (f.kind === 'node') {
      const set = new Set([f.lemma])
      for (const nb of adjacency.value.get(f.lemma) ?? []) set.add(nb.lemma)
      return set
    }
    return new Set(
      (network.value?.nodes ?? []).filter((n) => n.community === f.id).map((n) => n.lemma),
    )
  })

  const nodeByLemma = computed(
    () => new Map((network.value?.nodes ?? []).map((n) => [n.lemma, n])),
  )

  // Lemme minusculé → lemme réel du graphe (pour l'appariement casse-insensible
  // du focus depuis selectedLemma).
  const nodeKeyLower = computed(
    () => new Map((network.value?.nodes ?? []).map((n) => [n.lemma.toLowerCase(), n.lemma])),
  )

  // Champs lexicaux : une entrée par communauté, membres triés par fréquence.
  const communities = computed(() => {
    const nodes = network.value?.nodes ?? []
    const byId = new Map()
    for (const n of nodes) {
      if (!byId.has(n.community)) byId.set(n.community, [])
      byId.get(n.community).push(n)
    }
    return [...byId.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, members]) => ({
        id,
        color: communityColor(id),
        size: members.length,
        members: members.slice().sort((a, b) => b.count - a.count),
      }))
  })

  // Mots-ponts : plus fortes betweenness (au-dessus de 0), triés décroissant.
  const bridges = computed(() =>
    (network.value?.nodes ?? [])
      .filter((n) => n.centrality > 0)
      .sort((a, b) => b.centrality - a.centrality)
      .slice(0, 6),
  )

  // Détail du mot focalisé pour l'inspecteur (null si focus non-nœud).
  const inspected = computed(() => {
    const f = focus.value
    if (f?.kind !== 'node') return null
    const node = nodeByLemma.value.get(f.lemma)
    if (!node) return null
    const associations = (adjacency.value.get(f.lemma) ?? [])
      .slice()
      .sort((a, b) => b.npmi - a.npmi)
    return { node, associations }
  })

  // Index des mots du NUAGE (mêmes que VocabulaireCloud : entités pour les noms
  // propres, lemmes pour le reste) → aucun différentiel node-clic vs nuage.
  const wordIndex = computed(() =>
    buildWordIndex(buildCloudWords(lexical.value?.lemmas, lexical.value?.entities)),
  )

  function selectNode(lemma) {
    selectedCommunity.value = null
    const current = selectedLemma.value?.lemma
    if (current && current.toLowerCase() === lemma.toLowerCase()) {
      selectedLemma.value = null
      return
    }
    const node = nodeByLemma.value.get(lemma)
    selectedLemma.value = resolveSelection(lemma, wordIndex.value, node?.count ?? 0)
  }
  function selectCommunity(id) {
    selectedLemma.value = null
    selectedCommunity.value = selectedCommunity.value === id ? null : id
  }
  function clear() {
    selectedLemma.value = null
    selectedCommunity.value = null
  }

  const store = {
    network,
    focus,
    threshold,
    npmiExtent,
    visibleEdges,
    connectedLemmas,
    highlighted,
    communities,
    bridges,
    inspected,
    nodeByLemma,
    communityColor,
    selectNode,
    selectCommunity,
    clear,
  }
  provide(KEY, store)
  return store
}

export function useLexicalGraph() {
  return inject(KEY)
}
