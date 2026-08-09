// Métriques de graphe pures pour le réseau lexical. Déterministes à ordre de nœuds fixé
// (le layout est caché par signature). Taille bornée (≤ 50 nœuds) → coûts quadratiques OK.

// Louvain mono-niveau pondéré par NPMI (deux mots fréquents mais peu spécifiquement
// associés ne doivent pas fusionner). Rend { [lemma]: communityId }, ids 0..k-1 triés
// par taille décroissante (couleur stable).
export function detectCommunities(nodes, edges) {
  const N = nodes.length
  const index = new Map(nodes.map((n, i) => [n.lemma, i]))
  const adj = Array.from({ length: N }, () => new Map())
  const deg = new Array(N).fill(0)
  let m = 0
  for (const e of edges) {
    const a = index.get(e.source)
    const b = index.get(e.target)
    if (a === undefined || b === undefined || a === b) continue
    const w = e.npmi > 0 ? e.npmi : 1e-4
    adj[a].set(b, (adj[a].get(b) || 0) + w)
    adj[b].set(a, (adj[b].get(a) || 0) + w)
    deg[a] += w
    deg[b] += w
    m += w
  }

  const comm = nodes.map((_, i) => i)
  if (m > 0) {
    const twoM = 2 * m
    const sigmaTot = deg.slice()
    let improved = true
    let guard = 0
    while (improved && guard++ < 50) {
      improved = false
      for (let i = 0; i < N; i++) {
        const ci = comm[i]
        const wTo = new Map() // poids de i vers chaque communauté voisine
        for (const [j, w] of adj[i]) {
          const cj = comm[j]
          wTo.set(cj, (wTo.get(cj) || 0) + w)
        }
        sigmaTot[ci] -= deg[i]
        let best = ci
        let bestGain = (wTo.get(ci) || 0) - (sigmaTot[ci] * deg[i]) / twoM
        for (const [c, wic] of wTo) {
          if (c === ci) continue
          const gain = wic - (sigmaTot[c] * deg[i]) / twoM
          if (gain > bestGain + 1e-12) {
            bestGain = gain
            best = c
          }
        }
        sigmaTot[best] += deg[i]
        if (best !== ci) {
          comm[i] = best
          improved = true
        }
      }
    }
  }

  // Compaction + tri par taille (tie-break déterministe sur le premier nœud).
  const members = new Map()
  comm.forEach((c, i) => {
    if (!members.has(c)) members.set(c, [])
    members.get(c).push(i)
  })
  const ordered = [...members.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[1][0] - b[1][0],
  )
  const newId = new Map()
  ordered.forEach(([c], k) => newId.set(c, k))
  const out = {}
  nodes.forEach((n, i) => {
    out[n.lemma] = newId.get(comm[i])
  })
  return out
}

// Betweenness (Brandes), non pondérée : révèle les mots-ponts entre champs lexicaux.
// Normalisée par le max → 0..1.
export function betweenness(nodes, edges) {
  const N = nodes.length
  const index = new Map(nodes.map((n, i) => [n.lemma, i]))
  const adj = Array.from({ length: N }, () => [])
  for (const e of edges) {
    const a = index.get(e.source)
    const b = index.get(e.target)
    if (a === undefined || b === undefined || a === b) continue
    adj[a].push(b)
    adj[b].push(a)
  }

  const cb = new Array(N).fill(0)
  for (let s = 0; s < N; s++) {
    const stack = []
    const pred = Array.from({ length: N }, () => [])
    const sigma = new Array(N).fill(0)
    sigma[s] = 1
    const dist = new Array(N).fill(-1)
    dist[s] = 0
    const queue = [s]
    while (queue.length) {
      const v = queue.shift()
      stack.push(v)
      for (const w of adj[v]) {
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1
          queue.push(w)
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v]
          pred[w].push(v)
        }
      }
    }
    const delta = new Array(N).fill(0)
    while (stack.length) {
      const w = stack.pop()
      for (const v of pred[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
      }
      if (w !== s) cb[w] += delta[w]
    }
  }

  const max = Math.max(...cb, 0)
  const out = {}
  nodes.forEach((n, i) => {
    out[n.lemma] = max > 0 ? cb[i] / max : 0
  })
  return out
}
