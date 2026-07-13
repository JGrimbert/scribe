// Paires d'articles dédupliquées à partir des voisinages top-K des unités
// sémantiques (la matrice complète n'est pas persistée côté backend). Partagé
// par les cards « Textes identiques » et « Paires les plus proches ».

// Au-delà, deux articles partagent un texte identique ou quasi identique
// (doublons réels du manuscrit : intros de blocs copiées) — information utile
// mais séparée, sinon elle sature le classement.
export const DUPLICATE_THRESHOLD = 0.995

export function buildPairs(units) {
  const byKey = new Map()
  for (const unit of units ?? []) {
    for (const neighbor of unit.neighbors) {
      const key = [unit.nodeId, neighbor.nodeId].sort().join('|')
      const known = byKey.get(key)
      if (!known || known.score < neighbor.score) {
        byKey.set(key, { key, a: unit.nodeId, b: neighbor.nodeId, score: neighbor.score })
      }
    }
  }
  return Array.from(byKey.values()).sort((x, y) => y.score - x.score)
}
