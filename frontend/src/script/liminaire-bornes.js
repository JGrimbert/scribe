// Déplacement LOCAL de la borne de fin du liminaire — une prévisualisation, pas
// une décision. Rien ici n'est persistable : la borne réelle est un index de
// TITRE dans l'outline du .odt, et seul un recalibrage (qui reparse le fichier)
// peut la déplacer pour de bon. Ce module sert à VOIR ce qu'on s'apprête à
// inclure avant de payer ce prix.
//
// Corollaire, et c'est ce qui rend l'opération asymétrique : les paragraphes
// qui précèdent le PREMIER titre sont liminaires par construction. Aucune borne
// ne peut les renvoyer au corps du livre — il faudrait une borne à l'échelle du
// paragraphe, que la calibration ne modélise pas. D'où `shift >= 0` : on étend,
// et « exclure » ne fait que défaire une extension.

// Les nœuds dans l'ORDRE DU DOCUMENT (parcours préfixe) : c'est l'ordre dans
// lequel la calibration les rencontre, donc celui dans lequel la borne les
// absorbe. `trame.axes` ne porte que des ids, le contenu vit dans `data`.
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

// Un nœud absorbé rend son TITRE puis son texte propre. Le titre devient une
// entrée ordinaire — c'est ce qu'il redeviendra après recalibrage, le liminaire
// n'ayant pas de hiérarchie. `pageStart` parce qu'un titre ouvre une page ;
// sans lui, le nœud se collerait à la dernière page du liminaire.
// Le styleName est volontairement NEUTRE : un nom que `typeOfStyleName`
// reconnaîtrait (« Dédicace »…) poserait une frontière de type sur une page
// qui n'en est pas une.
export function nodeToEntries(node) {
  const title = (node?.titre ?? '').trim()
  const entries = []
  if (title) {
    entries.push({ type: 'paragraph', text: title, styleName: 'Titre absorbé', pageStart: 'page' })
  }
  for (const entry of node?.texte ?? []) entries.push(entry)
  return entries
}

// Le liminaire étendu de `shift` nœuds. `shift` est borné par le nombre de
// nœuds disponibles — étendre au-delà du dernier chapitre ne veut rien dire.
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

// Le titre du prochain nœud à absorber — ce que le bouton « Étendre » promet.
// Sans lui, l'action est un saut dans le noir.
export function nextNodeTitle(axes, data, shift) {
  const nodes = nodesInOrder(axes, data)
  const next = nodes[clampShift(shift, axes, data)]
  return next ? (next.titre ?? '').trim() || 'Sans titre' : null
}
