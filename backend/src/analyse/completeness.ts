import { DataMap, TrameNode } from '../import/odt-parser'
import { computeStats } from '../import/odt-parser/text-utils'
import { plainNodeText } from './plain-text'

// On ne dépend que de l'arbre des axes (pas de meta/preambule) — accepte donc
// la trame réduite renvoyée par DocumentsService.getContent.
type AxesTree = { axes: TrameNode[] }

// Gate de complétude : classe chaque nœud selon la quantité de texte PROPRE
// (jamais agrégée sur les descendants — cohérent avec la segmentation, qui
// découpe le texte propre nœud par nœud). Réutilise la taxonomie du parseur
// (`computeStats` : vide / ébauche < 50 mots / partiel < 200 / rédigé) —
// source unique du seuil, pas de constante dupliquée.
//
// Deux usages, un seul calcul :
// - exclusion du corpus d'analyse thématique (`stubNodeIds`) : TOUT nœud
//   « stub » (vide ou ébauche), y compris un nœud-conteneur dont le court
//   intro ne ferait que bruiter BERTopic ;
// - table des anomalies (`assessCompleteness`) : uniquement les FEUILLES
//   stub — un chapitre avec un titre mais (presque) pas de corps, en attente
//   de rédaction. Un conteneur vide (axe sans préambule) est une structure
//   normale, pas une anomalie.

export type CompletenessStatus = 'vide' | 'ébauche' | 'partiel' | 'rédigé'

const STUB_MAX_WORDS = 50 // frontière « ébauche » de computeStats

const isStub = (status: CompletenessStatus) => status === 'vide' || status === 'ébauche'

export interface CompletenessAnomaly {
  nodeId: string
  titre: string
  words: number
  status: 'vide' | 'ébauche'
}

export interface CompletenessAnalysis {
  threshold: number // mots ; en deçà, un nœud est considéré en attente
  leafCount: number // feuilles totales (chapitres potentiels), pour le dénominateur
  anomalies: CompletenessAnomaly[] // feuilles en attente, dans l'ordre du document
}

interface NodeCompleteness {
  nodeId: string
  titre: string
  words: number
  isLeaf: boolean
  status: CompletenessStatus
}

function classify(trame: AxesTree, data: DataMap): NodeCompleteness[] {
  const out: NodeCompleteness[] = []
  const walk = (node: TrameNode) => {
    const item = data[node.id]
    if (item) {
      const stats = computeStats(plainNodeText(item.texte))
      out.push({
        nodeId: node.id,
        titre: item.titre,
        words: stats.mots,
        isLeaf: node.children.length === 0,
        status: stats.status,
      })
    }
    node.children.forEach(walk)
  }
  trame.axes.forEach(walk)
  return out
}

// Nœuds à retirer du corpus thématique : tous les stubs (le texte propre est
// trop court pour porter un thème, qu'il s'agisse d'une feuille ou d'un intro
// de conteneur).
export function stubNodeIds(trame: AxesTree, data: DataMap): Set<string> {
  return new Set(
    classify(trame, data)
      .filter((n) => isStub(n.status))
      .map((n) => n.nodeId),
  )
}

export function assessCompleteness(trame: AxesTree, data: DataMap): CompletenessAnalysis {
  const nodes = classify(trame, data)
  const leaves = nodes.filter((n) => n.isLeaf)
  const anomalies = leaves
    .filter((n) => isStub(n.status))
    .map((n) => ({ nodeId: n.nodeId, titre: n.titre, words: n.words, status: n.status as 'vide' | 'ébauche' }))
  return { threshold: STUB_MAX_WORDS, leafCount: leaves.length, anomalies }
}
