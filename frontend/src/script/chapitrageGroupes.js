// Les nœuds d'un niveau rangés par ÉCART AU MODÈLE (celui du premier nœud du niveau),
// en quelques FAMILLES de cas plutôt qu'une liste plate. Écart mesuré sur l'ensemble
// des styles (présence), pas sur leur suite : grouper sur l'ordre rendrait des groupes
// d'un seul nœud.

import { nodeStyleSet } from './chapitrageValidation'

// Écart au modèle. `missing` suit l'ordre du modèle ; `extra` est trié (les styles
// hors modèle n'ont pas d'ordre naturel).
export function deviation(styles, modelNames) {
  const model = modelNames ?? []
  const inModel = new Set(model)
  return {
    missing: model.filter((name) => !styles.has(name)),
    extra: [...styles].filter((name) => !inModel.has(name)).sort(),
  }
}

// Groupes de nœuds à écart identique : le groupe conforme d'abord, puis par effectif.
// `styles` = styles du groupe dans leur ordre d'apparition (relevé sur son 1er nœud).
// `[{ key, styles, missing, extra, count, nodes }]`
export function groupByDeviation(nodes, modelNames, titleStyleOf = () => null) {
  const groups = new Map()

  for (const node of nodes ?? []) {
    const styles = nodeStyleSet(node.shape, titleStyleOf(node.nodeId))
    const { missing, extra } = deviation(styles, modelNames)
    // Sérialisée : un nom de style peut contenir n'importe quel séparateur.
    const key = JSON.stringify([missing, extra])
    let group = groups.get(key)
    if (!group) {
      group = { key, missing, extra, styles: [...styles], count: 0, nodes: [] }
      groups.set(key, group)
    }
    group.count++
    group.nodes.push({ nodeId: node.nodeId, titre: node.titre })
  }

  return [...groups.values()].sort((a, b) => {
    const conform = (g) => (g.missing.length || g.extra.length ? 1 : 0)
    return conform(a) - conform(b) || b.count - a.count || a.key.localeCompare(b.key)
  })
}
