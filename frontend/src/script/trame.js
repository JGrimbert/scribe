// Helpers purs sur l'arbre `trame` (`{ id, children: [...] }` à profondeur
// arbitraire). Partagés entre la sidebar (StructureView) et le fil d'Ariane
// (DocumentBar) pour ne pas dupliquer le parcours.

// Chemin (ids des ancêtres + le nœud lui-même) de la racine `node` vers `id`,
// ou null si `id` n'est pas dans ce sous-arbre.
export function pathTo(node, id) {
  if (node.id === id) return [node.id]
  for (const child of node.children) {
    const sub = pathTo(child, id)
    if (sub) return [node.id, ...sub]
  }
  return null
}

// Chemin d'ids vers `id` en balayant tous les axes de tête, ou [] si absent.
export function pathToInAxes(axes, id) {
  for (const axe of axes) {
    const path = pathTo(axe, id)
    if (path) return path
  }
  return []
}
