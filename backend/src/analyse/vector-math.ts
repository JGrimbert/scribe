// Maths vectorielles pures pour la proximité sémantique. Les vecteurs
// arrivent déjà L2-normalisés du service Python : cosinus = produit scalaire.

export function dot(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

// Moyenne des vecteurs puis renormalisation L2 — la moyenne de vecteurs
// unitaires n'est pas unitaire, sans renormalisation les articles longs
// seraient systématiquement "moins proches" de tout.
export function meanNormalized(vectors: number[][]): number[] {
  const mean = new Array<number>(vectors[0].length).fill(0)
  for (const vector of vectors) {
    for (let i = 0; i < vector.length; i++) mean[i] += vector[i]
  }
  let norm = 0
  for (let i = 0; i < mean.length; i++) {
    mean[i] /= vectors.length
    norm += mean[i] * mean[i]
  }
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < mean.length; i++) mean[i] /= norm
  return mean
}
