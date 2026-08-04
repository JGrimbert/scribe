// Les nœuds d'un niveau de chapitrage rangés par ÉCART AU MODÈLE — le modèle
// étant celui du premier nœud du niveau (cf. modelStyleNames / chapitrageModele).
// On ne veut pas une liste plate de 818 nœuds mais les quelques FAMILLES de cas
// qui s'en écartent : « N nœuds qui n'ont que leur titre », « N nœuds qui portent
// tel style en plus »…
//
// Écart mesuré sur l'ENSEMBLE des styles (présence), pas sur leur suite : l'ordre
// des paragraphes d'un chapitre varie pour des raisons de rédaction, grouper
// dessus rendrait des dizaines de groupes d'un seul nœud. Même portée que
// `chapitrageValidation` (styles et rien d'autre).

import { nodeStyleSet } from './chapitrageValidation'

/**
 * L'écart d'un jeu de styles au modèle.
 * `missing` suit l'ordre DU MODÈLE (celui du texte, titre en tête) ; `extra` est
 * trié alphabétiquement — des styles hors modèle n'ont pas d'ordre naturel.
 */
export function deviation(styles, modelNames) {
  const model = modelNames ?? []
  const inModel = new Set(model)
  return {
    missing: model.filter((name) => !styles.has(name)),
    extra: [...styles].filter((name) => !inModel.has(name)).sort(),
  }
}

/**
 * Groupes de nœuds à écart identique.
 *
 * @param nodes        `[{ nodeId, titre, shape }]` — les nœuds du niveau, en ordre de lecture
 * @param modelNames   styles du modèle (cf. modelStyleNames)
 * @param titleStyleOf `(nodeId) => styleName | null` — le titre n'est pas une entrée de `texte`
 * @returns `[{ key, styles, missing, extra, count, nodes }]` — le groupe CONFORME
 *          d'abord (c'est le repère), puis les autres par effectif décroissant.
 *          `nodes` garde l'ordre de lecture ; `styles` = les styles du groupe dans
 *          leur ORDRE D'APPARITION dans le texte (titre en tête), relevé sur son
 *          premier nœud — deux styles qui occupent le même rang d'un groupe à
 *          l'autre se lisent alors comme ce qu'ils sont : deux façons d'écrire la
 *          même chose. L'ensemble, lui, est le même pour tout le groupe.
 */
export function groupByDeviation(nodes, modelNames, titleStyleOf = () => null) {
  const groups = new Map()

  for (const node of nodes ?? []) {
    const styles = nodeStyleSet(node.shape, titleStyleOf(node.nodeId))
    const { missing, extra } = deviation(styles, modelNames)
    // Clé sérialisée plutôt que concaténée : un nom de style peut contenir
    // n'importe quel séparateur qu'on choisirait.
    const key = JSON.stringify([missing, extra])
    let group = groups.get(key)
    if (!group) {
      // `nodeStyleSet` insère le titre puis les runs dans l'ordre du texte, et un
      // Set garde son ordre d'insertion : la liste EST l'ordre d'apparition.
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
