// Helpers purs sur l'arbre `trame` (`{ id, children }`), partagés entre la sidebar et
// le fil d'Ariane.

// Chemin (ids des ancêtres + le nœud) de `node` vers `id`, ou null si absent du sous-arbre.
export function pathTo(node, id) {
  if (node.id === id) return [node.id]
  for (const child of node.children) {
    const sub = pathTo(child, id)
    if (sub) return [node.id, ...sub]
  }
  return null
}

// Chemin d'ids vers `id` en balayant tous les axes, ou [] si absent.
export function pathToInAxes(axes, id) {
  for (const axe of axes) {
    const path = pathTo(axe, id)
    if (path) return path
  }
  return []
}

// Tous les nœuds dans l'ordre de LECTURE, sous forme `{ id, titre, path }` (path = fil
// d'Ariane des titres ancêtres). Même forme que l'index de useDocSearch (pour que les
// passages annotés se coulent dans le même fragmentPages).
export function bookNodes(axes, data) {
  if (!axes || !data) return []
  const out = []
  const walk = (node, ancestors) => {
    const titre = data[node.id]?.titre || '(sans titre)'
    out.push({ id: node.id, titre, path: ancestors.join(' › ') })
    for (const child of node.children ?? []) walk(child, [...ancestors, titre])
  }
  for (const axe of axes) walk(axe, [])
  return out
}
