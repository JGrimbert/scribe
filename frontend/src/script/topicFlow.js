// « Au fil du livre » : où chaque thème se pose dans l'ordre de lecture. Logique
// PURE — croise la projection des thèmes (un point par segment, cf. backend
// analyse.service) avec l'ordre des nœuds de la trame.
//
// La carte UMAP (ThemesMap) dit quels thèmes se ressemblent ; elle ne dit pas
// lequel ouvre le livre et lequel n'arrive qu'au dernier tiers. C'est cette
// seconde question — la seule qui intéresse la maquette — que ce flux répond.

// Les nœuds dans l'ORDRE DE LECTURE (parcours préfixe de la trame, comme le
// document se lit) — le rang dans cette liste EST la position sur l'axe, et le
// titre sert d'étiquette à l'infobulle.
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

// nodeId → rang de lecture.
export function readingIndex(axes) {
  return new Map(readingNodes(axes).map((node, i) => [node.id, i]))
}

// Un rang porte au plus UN point par thème : les segments d'un même thème dans un
// même chapitre s'additionnent (`count`), ce que la taille du symbole traduira.
// Les segments hors thème (topicId -1) et ceux dont le nœud a disparu de la trame
// sont écartés — un point sans place dans l'ordre de lecture n'est pas plaçable.
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

  // Un thème dont aucun segment n'est plaçable n'aurait qu'un axe vide à montrer.
  return { rows: rows.filter((r) => r.points.length), nodes }
}

// Le plus gros paquet de segments d'un même thème dans un même chapitre : c'est
// lui qui borne l'échelle des tailles de symbole (sinon chaque graphe aurait sa
// propre unité et deux documents ne se compareraient plus).
export function maxCount(rows) {
  return rows.reduce((max, row) => Math.max(max, ...row.points.map((p) => p.count)), 0)
}
