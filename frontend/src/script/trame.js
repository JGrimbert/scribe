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

// Tous les nœuds du livre dans l'ordre de LECTURE (parcours préfixe des axes), sous
// la forme `{ id, titre, path }` — `path` = fil d'Ariane des titres ancêtres joints
// par ' › ' (vide à la racine). Même forme que l'index de `useDocSearch`, pour que
// les passages annotés se coulent dans le même `fragmentPages` que les résultats de
// recherche (cf. script/annotations). `data` porte les titres (`data[id].titre`).
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
