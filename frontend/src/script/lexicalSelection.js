// Résolution d'un nœud du réseau lexical vers le mot du NUAGE correspondant.
//
// Deux écueils, d'où ce passage par les mots du nuage (buildCloudWords) plutôt
// que par les lemmes bruts :
//  1. Casse — un nœud est identifié par un lemme MINUSCULÉ (le NLP minuscule
//     tout côté graphe), le nuage préserve la casse des noms propres (« Margot »).
//  2. Fusion — pour un nom propre, le nuage montre l'ENTITÉ nommée (« Margot »,
//     220 occ / 136 articles), pas le lemme brut (279 / 164). Résoudre contre
//     `lemmas` rendait donc un différentiel avec ce qu'affiche le nuage.
//
// On indexe donc la même liste que VocabulaireCard, insensible à la casse, pour
// que cliquer le nœud « margot » affiche exactement le « Margot » du nuage.

// Index text-minuscule → mot du nuage { text, count, nodes, ... }.
export function buildWordIndex(words) {
  const index = new Map()
  for (const w of words ?? []) {
    const key = w.text.toLowerCase()
    const prev = index.get(key)
    // À collision de casse résiduelle, l'entrée la plus fréquente l'emporte
    // (buildCloudWords déduplique déjà l'essentiel).
    if (!prev || w.count > prev.count) index.set(key, w)
  }
  return index
}

// Forme attendue par selectedLemma / OccurrencesCard : { lemma, count, nodes }.
// `lemma` reprend la casse du mot du nuage (« Margot »). Repli sur le lemme
// cliqué + `fallbackCount` si le mot n'est pas dans le nuage.
export function resolveSelection(lemma, index, fallbackCount = 0) {
  const word = index.get(lemma.toLowerCase())
  return word
    ? { lemma: word.text, count: word.count, nodes: word.nodes ?? [] }
    : { lemma, count: fallbackCount, nodes: [] }
}
