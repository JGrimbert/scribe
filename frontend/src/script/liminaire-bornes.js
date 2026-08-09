// Déplacement LOCAL de la borne de fin du liminaire — prévisualisation, pas décision :
// la borne réelle est un index de titre dans l'outline du .odt, seul un recalibrage la
// déplace. `shift >= 0` : les paragraphes avant le premier titre sont liminaires par
// construction (aucune borne au paragraphe ne les renvoie au corps), donc on ne fait
// qu'étendre — « exclure » défait une extension.

// Nœuds dans l'ordre du document (parcours préfixe) : celui où la borne les absorbe.
export function nodesInOrder(axes, data) {
  const out = []
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      const content = data?.[node.id]
      if (content) out.push(content)
      walk(node.children)
    }
  }
  walk(axes)
  return out
}

// Un nœud absorbé rend son titre (entrée ordinaire, comme après recalibrage) puis son
// texte. `pageStart` car un titre ouvre une page. styleName NEUTRE : un nom reconnu par
// typeOfStyleName poserait une frontière de type sur une page qui n'en est pas une.
export function nodeToEntries(node) {
  const title = (node?.titre ?? '').trim()
  const entries = []
  if (title) {
    entries.push({ type: 'paragraph', text: title, styleName: 'Titre absorbé', pageStart: 'page' })
  }
  for (const entry of node?.texte ?? []) entries.push(entry)
  return entries
}

// Le liminaire étendu de `shift` nœuds (borné au nombre de nœuds disponibles).
export function extendedLiminaire(liminaire, axes, data, shift) {
  const n = clampShift(shift, axes, data)
  if (n <= 0) return liminaire ?? []
  const absorbed = nodesInOrder(axes, data).slice(0, n).flatMap(nodeToEntries)
  return [...(liminaire ?? []), ...absorbed]
}

export function absorbableCount(axes, data) {
  return nodesInOrder(axes, data).length
}

export function clampShift(shift, axes, data) {
  return Math.max(0, Math.min(shift ?? 0, absorbableCount(axes, data)))
}

// Titre du prochain nœud à absorber (ce que le bouton « Étendre » promet).
export function nextNodeTitle(axes, data, shift) {
  const nodes = nodesInOrder(axes, data)
  const next = nodes[clampShift(shift, axes, data)]
  return next ? (next.titre ?? '').trim() || 'Sans titre' : null
}
