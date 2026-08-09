// Résout un nœud du réseau lexical vers le mot du NUAGE correspondant. On passe par les
// mots du nuage (pas les lemmes bruts) pour deux raisons : la casse (le graphe minuscule
// tout, le nuage garde « Margot ») et la fusion des entités nommées (le nuage montre
// l'entité, pas le lemme brut). Insensible à la casse.

// Index text-minuscule → mot du nuage.
export function buildWordIndex(words) {
  const index = new Map()
  for (const w of words ?? []) {
    const key = w.text.toLowerCase()
    const prev = index.get(key)
    if (!prev || w.count > prev.count) index.set(key, w)
  }
  return index
}

// Forme attendue par selectedLemma / OccurrencesCard, repli sur le lemme cliqué si absent.
export function resolveSelection(lemma, index, fallbackCount = 0) {
  const word = index.get(lemma.toLowerCase())
  return word
    ? { lemma: word.text, count: word.count, nodes: word.nodes ?? [] }
    : { lemma, count: fallbackCount, nodes: [] }
}
