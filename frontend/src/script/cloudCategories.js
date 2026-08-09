// Construction et catégorisation des mots du nuage — logique pure. Deux sources : les
// LEMMES (spaCy) pour les mots communs (mauvais pour les propres, liste plafonnée), les
// ENTITÉS (NER) pour personnes/lieux. On combine.

export const POS_TO_KEY = { NOUN: 'nom', ADJ: 'adj', VERB: 'verbe', ADV: 'adverbe' }
const ENTITY_LABEL_TO_KEY = { PER: 'personne', LOC: 'lieu' }
const ENTITY_PRIORITY = { personne: 0, lieu: 1 }

// Part des occurrences reconnues comme entité pour classer personne/lieu plutôt que mot
// commun. Écarte le bruit NER (« Amour », « Terre » en début de phrase).
export const ENTITY_MATCH_RATIO = 0.4
const NAME_MIN_LETTERS = 2 // écarte les initiales « I », « I. »

function isCapitalized(token) {
  const c = token[0]
  return !!c && c !== c.toLowerCase()
}

function letterCount(token) {
  return (token.match(/\p{L}/gu) ?? []).length
}

// Noms de personnes/lieux depuis les entités : mono-token, capitalisés, dédupliqués
// (priorité PER > LOC, occurrence max), bruit filtré via le ratio.
// Map clé(minuscule) → { text, category, count, nodes }.
function extractNames(entities, lemmaCountByText) {
  const byText = new Map()
  for (const e of entities ?? []) {
    const category = ENTITY_LABEL_TO_KEY[e.label]
    if (!category) continue
    const tokens = e.text.split(/\s+/)
    if (tokens.length !== 1) continue // spans multi-mots = variantes
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

// Mots du nuage triés par occurrence décroissante. { text, category, count, nodes },
// category ∈ nom|adj|verbe|adverbe|personne|lieu.
export function buildCloudWords(lemmas, entities) {
  const lemmaCountByText = new Map((lemmas ?? []).map((l) => [l.lemma.toLowerCase(), l.count]))
  const names = extractNames(entities, lemmaCountByText)

  const words = [...names.values()]
  for (const l of lemmas ?? []) {
    if (names.has(l.lemma.toLowerCase())) continue
    // Un propre non capté par la NER retombe sur « personne » (rare).
    const category = POS_TO_KEY[l.pos] ?? (l.pos === 'PROPN' ? 'personne' : null)
    if (!category) continue
    words.push({ text: l.lemma, category, count: l.count, nodes: l.nodes ?? [] })
  }

  words.sort((a, b) => b.count - a.count)
  return words
}
