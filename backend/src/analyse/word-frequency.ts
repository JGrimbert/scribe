import { DataMap } from '../import/odt-parser'
import { STOPWORDS_FR } from './stopwords-fr'
import { plainNodeText } from './plain-text'

export interface WordFrequencyNodeEntry {
  nodeId: string
  titre: string
  count: number
}

export interface WordFrequencyEntry {
  word: string
  count: number
  nodes: WordFrequencyNodeEntry[]
}

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g')
const TOKEN_RE = /[^a-z]+/

function normalize(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase()
}

// Le HTML a déjà été retiré par plainNodeText (cf. plain-text.ts).
function tokenize(text: string): string[] {
  return normalize(text)
    .split(TOKEN_RE)
    .filter((word) => word.length >= 3 && !STOPWORDS_FR.has(word))
}

// Fréquence lexicale sur le contenu persisté (texte[] des nœuds — ni les
// titres, ni connexe.pistes/tableau, cf. plan "Analyse sémantique"),
// agrégée par mot avec répartition par nœud (pour la table de liens au clic
// côté frontend).
export function computeWordFrequency(data: DataMap): WordFrequencyEntry[] {
  const byWord = new Map<string, { count: number; nodes: Map<string, number> }>()

  for (const item of Object.values(data)) {
    for (const word of tokenize(plainNodeText(item.texte))) {
      let entry = byWord.get(word)
      if (!entry) {
        entry = { count: 0, nodes: new Map() }
        byWord.set(word, entry)
      }
      entry.count++
      entry.nodes.set(item.id, (entry.nodes.get(item.id) ?? 0) + 1)
    }
  }

  const titreById = new Map(Object.values(data).map((item) => [item.id, item.titre]))

  return Array.from(byWord.entries())
    .map(([word, { count, nodes }]) => ({
      word,
      count,
      nodes: Array.from(nodes.entries())
        .map(([nodeId, nodeCount]) => ({ nodeId, titre: titreById.get(nodeId) ?? '(sans titre)', count: nodeCount }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count)
}
