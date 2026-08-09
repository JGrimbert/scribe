import { pathToInAxes } from './trame'

// Helpers de parcours d'arbre par NIVEAU de chapitrage, purs (axes + data en
// paramètres). La clé de niveau est plafonnée à 2 comme les règles : « profondeur
// 2 et au-delà » est un seul niveau — on ne descend donc pas sous un nœud retenu.

// Profondeur d'un nœud dans l'arbre → clé de niveau des règles (0/1/2+, plafonnée).
export function depthKeyOf(axes, nodeId) {
  const path = pathToInAxes(axes ?? [], nodeId)
  return Math.min(Math.max(0, path.length - 1), 2)
}

// Tous les nœuds du livre à une clé de niveau donnée, dans l'ordre de lecture.
// depthKey 2 = « profondeur 2 et au-delà » : les enfants d'un nœud retenu relèvent
// du même niveau de règles, on ne les énumère donc pas séparément.
export function nodesAtDepthKey(axes, data, depthKey) {
  const out = []
  const walk = (node, depth) => {
    if (Math.min(depth, 2) === depthKey) {
      out.push({ nodeId: node.id, titre: data?.[node.id]?.titre ?? '(sans titre)' })
      return
    }
    for (const child of node.children ?? []) walk(child, depth + 1)
  }
  ;(axes ?? []).forEach((axe) => walk(axe, 0))
  return out
}

// Premier nœud du livre à une clé de niveau donnée (le témoin de l'aperçu).
export function firstNodeAtDepthKey(axes, data, depthKey) {
  return nodesAtDepthKey(axes, data, depthKey)[0]?.nodeId ?? null
}
