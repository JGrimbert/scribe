// « Validable » : un nœud satisfait-il les contraintes de STYLES de son niveau ?
// Logique pure sur les formes des nœuds. Portée bornée aux styles (les autres
// critères de conformité relèvent du backend). « Validé » = validation manuelle,
// détenue par DocumentLayout.

// Profondeur → clé de niveau (2 = « 2 et au-delà »), comme les règles et zoneOfDepth.
export function depthKeyOf(depth) {
  return Math.min(Math.max(depth ?? 0, 0), 2)
}

// Contraintes effectives d'un niveau : les styles du modèle par défaut, remplacés
// par les styles exigés dès qu'il y en a. Les successions ne sont jamais déduites du
// modèle (exiger un ordre non demandé condamnerait la moitié du livre).
export function levelConstraints(ruleSet, modelNames) {
  const required = ruleSet?.requiresStyles?.length ? [...ruleSet.requiresStyles] : [...(modelNames ?? [])]
  return {
    requiredStyles: required,
    adjacency: (ruleSet?.requiresAdjacency ?? []).map((pair) => [...pair]),
    fromModel: !ruleSet?.requiresStyles?.length,
  }
}

// Styles portés par un nœud : ceux de ses runs + celui de son titre.
export function nodeStyleSet(shape, titleStyle = null) {
  const set = new Set()
  if (titleStyle) set.add(titleStyle)
  for (const [name] of shape?.runs ?? []) if (name) set.add(name)
  return set
}

// « a toujours suivi de b », lu sur les runs (RLE). Vacuément vrai si `a` est absent.
// Un run de `a` répété (n > 1) échoue sauf si b === a — mais alors le dernier `a` n'a
// toujours pas de `a` après lui (runs voisins de même style fusionnés).
export function adjacencyHolds(runs, a, b) {
  const seq = runs ?? []
  for (let i = 0; i < seq.length; i++) {
    const [name, count] = seq[i]
    if (name !== a) continue
    if (count > 1 && b !== a) return false
    if (seq[i + 1]?.[0] !== b) return false
  }
  return true
}

// Verdict d'un nœud. `{ validable, missing: string[], broken: [a, b][] }`
export function evaluateNode(shape, constraints, titleStyle = null) {
  const present = nodeStyleSet(shape, titleStyle)
  const missing = (constraints?.requiredStyles ?? []).filter((name) => !present.has(name))
  const broken = (constraints?.adjacency ?? []).filter(([a, b]) => !adjacencyHolds(shape?.runs, a, b))
  return { validable: !missing.length && !broken.length, missing, broken }
}

// Décompte par niveau (les périmés ne comptent pas comme validés).
// `{ [depthKey]: { total, validables, valides, perimes } }`
export function tallyByDepth(shapes, { constraintsByDepth = {}, titleStyleOf = () => null, validations = {} } = {}) {
  const out = {}
  for (const shape of shapes ?? []) {
    const key = depthKeyOf(shape.depth)
    const tally = (out[key] ??= { total: 0, validables: 0, valides: 0, perimes: 0 })
    tally.total++
    if (evaluateNode(shape, constraintsByDepth[key], titleStyleOf(shape.nodeId)).validable) tally.validables++
    const state = validations[shape.nodeId]
    if (state === 'validé') tally.valides++
    else if (state === 'périmé') tally.perimes++
  }
  return out
}
