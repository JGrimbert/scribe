// « Au fil du livre » : où chaque thème se pose dans l'ordre de lecture. Logique pure —
// croise la projection des thèmes (un point par segment) avec l'ordre des nœuds. Répond
// à ce que la carte UMAP ne dit pas : quel thème ouvre le livre, lequel arrive tard.

// Nœuds dans l'ORDRE DE LECTURE : le rang EST la position sur l'axe.
export function readingNodes(axes) {
  const nodes = []
  const seen = new Set()
  const walk = (node) => {
    if (!seen.has(node.id)) {
      seen.add(node.id)
      nodes.push({ id: node.id, titre: node.titre ?? '' })
    }
    ;(node.children ?? []).forEach(walk)
  }
  ;(axes ?? []).forEach(walk)
  return nodes
}

export function readingIndex(axes) {
  return new Map(readingNodes(axes).map((node, i) => [node.id, i]))
}

// Un rang porte au plus un point par thème (les segments d'un même thème dans un même
// chapitre s'additionnent → `count`). Segments hors thème (-1) ou de nœud disparu écartés.
export function topicFlow(topics, axes, { maxTopics = 8 } = {}) {
  const nodes = readingNodes(axes)
  const index = new Map(nodes.map((node, i) => [node.id, i]))
  if (!topics?.topics?.length || !index.size) return { rows: [], nodes }

  const kept = topics.topics.slice(0, maxTopics)
  const counts = new Map(kept.map((t) => [t.topicId, new Map()]))

  for (const point of topics.projection ?? []) {
    const byRank = counts.get(point.topicId)
    const rank = index.get(point.nodeId)
    if (!byRank || rank === undefined) continue
    byRank.set(rank, (byRank.get(rank) ?? 0) + 1)
  }

  const rows = kept.map((topic) => {
    const byRank = counts.get(topic.topicId)
    return {
      topicId: topic.topicId,
      label: topic.label,
      points: [...byRank.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([rank, count]) => ({ rank, count })),
    }
  })

  return { rows: rows.filter((r) => r.points.length), nodes }
}

// Plus gros paquet de segments d'un thème dans un chapitre : borne l'échelle des tailles
// de symbole (sinon deux documents ne se compareraient plus).
export function maxCount(rows) {
  return rows.reduce((max, row) => Math.max(max, ...row.points.map((p) => p.count)), 0)
}
