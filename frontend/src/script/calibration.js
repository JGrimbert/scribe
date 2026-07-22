// Reconstruit, côté client, la même hiérarchie que le backend
// (buildParsedResult) : `effectiveLevel` ferme les ancêtres ouverts de niveau
// >= lui puis s'empile — un saut de niveau s'imbrique directement sous le
// dernier ancêtre survivant, sans nœud fantôme. Sert uniquement à prévisualiser
// l'accordéon de calibration, pas à valider.
export function buildTree(entries) {
  const roots = []
  const stack = [] // { node, level }
  for (const entry of entries) {
    const level = entry.effectiveLevel
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    const node = { entry, children: [] }
    const parent = stack[stack.length - 1]
    if (parent) parent.node.children.push(node)
    else roots.push(node)
    stack.push({ node, level })
  }
  return roots
}

// Répartit l'outline en trois : le liminaire (avant `startIndex`), le corps (entre
// les deux bornes, seul à passer par l'accordéon), la partie finale (à partir de
// `endIndex`). Les deux bouts ne sont pas de la structure : ils s'affichent à plat,
// dans l'ordre du document. `levelOverrides` (index → niveau forcé) prime sur le
// niveau relevé du document.
export function partitionOutline(outline, { startIndex, endIndex, levelOverrides = {} }) {
  const effectiveLevel = (e) => levelOverrides[e.index] ?? e.level
  const isFinal = (index) => endIndex != null && index >= endIndex
  const withLevel = (e) => ({ ...e, effectiveLevel: effectiveLevel(e) })
  const items = []

  for (const entry of outline) {
    if (entry.index < startIndex) items.push({ type: 'liminaire', entry: withLevel(entry) })
  }

  const bodyEntries = outline
      .filter((e) => e.index >= startIndex && !isFinal(e.index))
      .map(withLevel)

  for (const root of buildTree(bodyEntries)) {
    items.push({ type: 'node', node: root, entry: root.entry })
  }

  for (const entry of outline) {
    if (isFinal(entry.index)) items.push({ type: 'final', entry: withLevel(entry) })
  }

  return items
}
