// « Validable » : un nœud de chapitrage satisfait-il les contraintes de STYLES de
// son niveau ? Logique pure, évaluée côté client sur les formes des nœuds
// (`GET /documents/:id/structure-shapes`) — le décompte suit donc les cases
// cochées dans la table sans aller-retour réseau.
//
// Portée volontairement bornée aux styles : les autres critères de conformité
// (annotations, tableau, seuil de caractères) ne se lisent pas dans une forme,
// c'est le dashboard/backend qui les juge (cf. analyse/conformity.ts).
//
// « Validé », lui, n'est pas calculé : c'est la validation MANUELLE d'un chapitre
// (nodeId → 'validé' | 'périmé', détenue par DocumentLayout).

// Profondeur d'un nœud → clé de niveau (2 = « 2 et au-delà »), même regroupement
// que les règles et `zoneOfDepth`.
export function depthKeyOf(depth) {
  return Math.min(Math.max(depth ?? 0, 0), 2)
}

/**
 * Les contraintes effectives d'un niveau.
 *
 * Par défaut, « iso contraintes actuelles » = les styles du MODÈLE (ceux du nœud
 * témoin). Dès que le niveau exige des styles nommés (cases « exigé » de la
 * table), ce sont eux qui font foi — l'utilisateur a tranché, le modèle n'est
 * plus qu'une suggestion. Les successions, elles, ne sont jamais déduites du
 * modèle : exiger un ordre que personne n'a demandé condamnerait la moitié du
 * livre en silence.
 */
export function levelConstraints(ruleSet, modelNames) {
  const required = ruleSet?.requiresStyles?.length ? [...ruleSet.requiresStyles] : [...(modelNames ?? [])]
  return {
    requiredStyles: required,
    adjacency: (ruleSet?.requiresAdjacency ?? []).map((pair) => [...pair]),
    // Le décompte doit pouvoir dire d'où sortent ses critères.
    fromModel: !ruleSet?.requiresStyles?.length,
  }
}

// Les styles portés par un nœud : ceux de ses paragraphes (runs) plus celui de
// son titre, qui n'est pas une entrée de `texte`.
export function nodeStyleSet(shape, titleStyle = null) {
  const set = new Set()
  if (titleStyle) set.add(titleStyle)
  for (const [name] of shape?.runs ?? []) if (name) set.add(name)
  return set
}

/**
 * « a toujours suivi de b », lu sur les runs (RLE) plutôt que sur les
 * paragraphes : même verdict que le backend (`adjacencyHolds`, conformity.ts).
 * Vacuément vrai si `a` est absent — on n'exige pas sa présence, seulement que,
 * présent, il soit suivi de `b`. Un run de `a` répété (n > 1) signifie « a suivi
 * de a » : il échoue, sauf si b === a — mais alors le DERNIER a n'a toujours pas
 * de `a` après lui (deux runs voisins de même style sont fusionnés).
 */
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

/**
 * Verdict d'un nœud : ce qui lui manque pour être en règle.
 * @returns { validable, missing: string[], broken: [a, b][] }
 */
export function evaluateNode(shape, constraints, titleStyle = null) {
  const present = nodeStyleSet(shape, titleStyle)
  const missing = (constraints?.requiredStyles ?? []).filter((name) => !present.has(name))
  const broken = (constraints?.adjacency ?? []).filter(([a, b]) => !adjacencyHolds(shape?.runs, a, b))
  return { validable: !missing.length && !broken.length, missing, broken }
}

/**
 * Décompte par niveau : combien de nœuds, combien de validables (contraintes de
 * styles satisfaites), combien de validés à la main (et de périmés, qui ne
 * comptent pas comme validés — le texte a changé depuis la relecture).
 *
 * @param shapes             formes de TOUS les nœuds du livre
 * @param constraintsByDepth `{ [depthKey]: contraintes }` (cf. levelConstraints)
 * @param titleStyleOf       `(nodeId) => styleName | null`
 * @param validations        `{ [nodeId]: 'validé' | 'périmé' }`
 * @returns `{ [depthKey]: { total, validables, valides, perimes } }`
 */
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
