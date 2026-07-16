import { NlpGlobalStats, NlpLexicalGraph } from './nlp-client.service'
import { CompletenessAnalysis } from './completeness'
import { ConformityAnalysis } from './conformity'

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

// Nuage de mots : lemmes porteurs de sens (spaCy), avec nature grammaticale
// dominante (`pos`) pour le filtrage côté frontend et répartition par nœud.
export interface LexicalLemma {
  lemma: string
  pos: string
  count: number
  nodes: NodeRef[]
}

// Résultat de l'analyse spaCy, tel que persisté (colonne Json `lexical`)
// et renvoyé au frontend — les ids d'unités du service Python sont enrichis
// des titres de nœuds au moment de la persistance. `graph` absent des
// analyses calculées avant la phase 4 — relancer l'analyse pour l'obtenir.
export interface LexicalAnalysis {
  computedAt: string
  model: string
  global: NlpGlobalStats
  units: LexicalUnitStats[]
  entities: LexicalEntity[]
  graph?: NlpLexicalGraph
  // Absent des analyses calculées avant l'introduction du nuage lemmatisé —
  // relancer l'analyse lexicale pour l'obtenir.
  lemmas?: LexicalLemma[]
}

export interface SemanticNeighbor {
  nodeId: string
  score: number
}

export interface SemanticUnit {
  nodeId: string
  titre: string
  paragraphs: number
  neighbors: SemanticNeighbor[]
}

// Proximité sémantique entre nœuds : top-K voisins par nœud (matrice
// complète jamais persistée — 650² scores n'apporteraient rien de plus au
// frontend). Les voisins référencent les nodeId, les titres se résolvent
// via units.
export interface SemanticAnalysis {
  computedAt: string
  model: string
  dimensions: number
  units: SemanticUnit[]
}

export interface TopicWord {
  word: string
  weight: number
}

export interface TopicSummary {
  topicId: number
  label: string
  count: number
  share: number
  words: TopicWord[]
}

export interface TopicAxeDistribution {
  axeId: string | null // null = liminaire (hors axes)
  titre: string
  segments: number
  distribution: { topicId: number; count: number }[]
}

// Position d'un segment dans la carte 2D (UMAP), coordonnées 0..1.
export interface TopicProjectionPoint {
  x: number
  y: number
  topicId: number // -1 = hors thème
  nodeId: string
}

// Thèmes BERTopic : résumé par thème + répartition par axe (l'évolution des
// thèmes au fil du manuscrit). Les segments hors thème (outliers HDBSCAN)
// sont comptés à part, pas mélangés aux thèmes. `projection` absente des
// analyses antérieures à la phase 4.
export interface TopicsAnalysis {
  computedAt: string
  model: string
  params: Record<string, unknown>
  segmentsTotal: number
  outliers: { count: number; share: number }
  topics: TopicSummary[]
  axes: TopicAxeDistribution[]
  projection?: TopicProjectionPoint[]
}

export interface TopicsJobStatusResponse {
  status: 'queued' | 'running' | 'done' | 'error'
  pct: number
  step: string
  error?: string
  analysis?: DocumentAnalysisResponse
}

// Chaque volet est null tant qu'il n'a pas été calculé (plus de 404 : les
// analyses sont indépendantes, l'une peut exister sans les autres).
export interface DocumentAnalysisResponse {
  lexical: LexicalAnalysis | null
  semantic: SemanticAnalysis | null
  topics: TopicsAnalysis | null
  // Toujours présent : dérivé du contenu (comptes de mots), sans NLP — la
  // carte des anomalies s'affiche donc avant tout calcul d'analyse.
  completeness: CompletenessAnalysis
  // Même nature (dérivé, sans NLP, jamais persisté). `available: false` tant
  // que la typologie des styles n'est pas arbitrée : sans elle, « sans
  // annotation » ne veut rien dire.
  conformity: ConformityAnalysis
}
