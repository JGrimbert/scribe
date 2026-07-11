import { WordFrequencyEntry } from './word-frequency'
import { NlpGlobalStats } from './nlp-client.service'

export interface NodeRef {
  nodeId: string
  titre: string
  count: number
}

export interface LexicalUnitStats {
  nodeId: string
  titre: string
  sentences: number
  words: number
  avgSentenceLength: number
  ttr: number
  lexicalDensity: number
}

export interface LexicalEntity {
  text: string
  label: string
  count: number
  nodes: NodeRef[]
}

// Résultat de l'analyse spaCy, tel que persisté (colonne Json `lexical`)
// et renvoyé au frontend — les ids d'unités du service Python sont enrichis
// des titres de nœuds au moment de la persistance.
export interface LexicalAnalysis {
  computedAt: string
  model: string
  global: NlpGlobalStats
  units: LexicalUnitStats[]
  entities: LexicalEntity[]
}

// Chaque volet est null tant qu'il n'a pas été calculé (plus de 404 : les
// deux analyses sont indépendantes, l'une peut exister sans l'autre).
export interface DocumentAnalysisResponse {
  wordFrequency: { computedAt: string; entries: WordFrequencyEntry[] } | null
  lexical: LexicalAnalysis | null
}
