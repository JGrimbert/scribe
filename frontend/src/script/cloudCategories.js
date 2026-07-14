// Construction et catégorisation des mots du nuage — logique pure (testable).
//
// Deux sources, car aucune seule ne suffit :
//  - Les LEMMES (spaCy) donnent les mots communs (noms, adjectifs, verbes,
//    adverbes) mais sont un mauvais support pour les noms propres : le modèle
//    français sous-étiquette les prénoms en NOUN, et surtout la liste est
//    plafonnée (~300 lemmes) donc les noms peu fréquents en sont absents.
//  - Les ENTITÉS (NER) donnent les personnes/lieux de façon fiable et complète,
//    avec leurs occurrences par nœud (mêmes `nodes` que les lemmes).
//
// On combine : personnes/lieux depuis les entités, le reste depuis les lemmes.

export const POS_TO_KEY = { NOUN: 'nom', ADJ: 'adj', VERB: 'verbe', ADV: 'adverbe' }
const ENTITY_LABEL_TO_KEY = { PER: 'personne', LOC: 'lieu' }
const ENTITY_PRIORITY = { personne: 0, lieu: 1 }

// Part minimale des occurrences d'un mot qui doivent être reconnues comme entité
// pour le classer personne/lieu plutôt que mot commun. Écarte le bruit NER : un
// mot commun capitalisé en début de phrase (« Amour », « Sol », « Terre »)
// n'est entité qu'une poignée de fois sur ses centaines d'occurrences. Réglable.
export const ENTITY_MATCH_RATIO = 0.4
// Nombre minimal de lettres d'un nom (écarte les initiales « I », « I. »).
const NAME_MIN_LETTERS = 2

function isCapitalized(token) {
  const c = token[0]
  return !!c && c !== c.toLowerCase()
}

function letterCount(token) {
  return (token.match(/\p{L}/gu) ?? []).length
}

// Noms de personnes/lieux depuis les entités NER : mono-token, capitalisés,
// dédupliqués (priorité PER > LOC, occurrence max), filtrés du bruit via le
// ratio. Retourne une Map clé(minuscule) → { text, category, count, nodes }.
function extractNames(entities, lemmaCountByText) {
  const byText = new Map()
  for (const e of entities ?? []) {
    const category = ENTITY_LABEL_TO_KEY[e.label]
    if (!category) continue
    const tokens = e.text.split(/\s+/)
    if (tokens.length !== 1) continue // les spans multi-mots sont des variantes
    const token = tokens[0]
    if (!isCapitalized(token) || letterCount(token) < NAME_MIN_LETTERS) continue

    const key = token.toLowerCase()
    // Bruit : le mot existe surtout comme lemme commun (occurrences ≫ entité).
    const lemmaCount = lemmaCountByText.get(key) ?? 0
    if (lemmaCount > 0 && e.count < ENTITY_MATCH_RATIO * lemmaCount) continue

    const cur = byText.get(key)
    if (!cur) {
      byText.set(key, { text: token, category, count: e.count, nodes: e.nodes ?? [] })
      continue
    }
    if (ENTITY_PRIORITY[category] < ENTITY_PRIORITY[cur.category]) cur.category = category
    if (e.count > cur.count) {
      cur.count = e.count
      cur.nodes = e.nodes ?? []
      cur.text = token
    }
  }
  return byText
}

// Liste des mots du nuage, triés par occurrence décroissante. Chaque mot :
// { text, category, count, nodes }. `category` ∈ nom|adj|verbe|adverbe|personne|lieu.
export function buildCloudWords(lemmas, entities) {
  const lemmaCountByText = new Map((lemmas ?? []).map((l) => [l.lemma.toLowerCase(), l.count]))
  const names = extractNames(entities, lemmaCountByText)

  const words = [...names.values()]
  for (const l of lemmas ?? []) {
    // Un lemme déjà couvert par une entité nommée n'est pas redoublé.
    if (names.has(l.lemma.toLowerCase())) continue
    // Nature grammaticale directe ; un propre non capté par la NER retombe sur
    // « personne » (rare, mais on ne le perd pas).
    const category = POS_TO_KEY[l.pos] ?? (l.pos === 'PROPN' ? 'personne' : null)
    if (!category) continue
    words.push({ text: l.lemma, category, count: l.count, nodes: l.nodes ?? [] })
  }

  words.sort((a, b) => b.count - a.count)
  return words
}
