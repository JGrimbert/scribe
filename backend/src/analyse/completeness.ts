import { DataMap, TrameNode } from '../import/odt-parser'
import { computeStats } from '../import/odt-parser/text-utils'
import { nodeContentHash, plainNodeText } from './plain-text'

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

// État CALCULÉ, dérivé du seul compte de mots (computeStats).
export type CompletenessStatus = 'vide' | 'ébauche' | 'partiel' | 'rédigé'

// État AFFICHÉ = état calculé, sauf si l'utilisateur a validé le chapitre :
// - « validé » : validation présente et le texte n'a pas bougé depuis ;
// - « périmé » : validation présente mais le texte a changé (hash différent)
//   — la relecture est à refaire. Volontairement distinct plutôt qu'une
//   dévalidation silencieuse : une correction de virgule ne doit pas détruire
//   une relecture sans que ça se voie.
// Ces deux-là ne sont PAS des paliers de rédaction mais des décisions
// humaines : d'où leur couleur de statut côté frontend (vert / ambre), et non
// une teinte de la rampe ordinale.
export type CompletenessDisplayStatus = CompletenessStatus | 'validé' | 'périmé'

// Ordre du plus vide au plus abouti : porté par le tableau `distribution` (pas
// par les clés d'un objet) pour que la progression reste lisible côté client
// sans y redéfinir l'ordre. « périmé » ferme la marche — il vient après
// « validé » puisqu'on en vient, et c'est là que l'œil doit s'arrêter.
const STATUS_SCALE: CompletenessDisplayStatus[] = [
  'vide',
  'ébauche',
  'partiel',
  'rédigé',
  'validé',
  'périmé',
]

const STUB_MAX_WORDS = 50 // frontière « ébauche » de computeStats

// nodeId → contentHash de la validation en base.
export type ValidationMap = Map<string, string>

const isStub = (status: CompletenessStatus) => status === 'vide' || status === 'ébauche'

export interface CompletenessAnomaly {
  nodeId: string
  titre: string
  words: number
  status: 'vide' | 'ébauche'
}

export interface CompletenessSlice {
  status: CompletenessDisplayStatus
  count: number
}

// Une barre du graphique de complétude : un axe de tête, ou le total.
export interface CompletenessGroup {
  nodeId: string | null // null = la barre « Total »
  titre: string
  leafCount: number
  distribution: CompletenessSlice[]
}

export interface CompletenessAnalysis {
  threshold: number // mots ; en deçà, un nœud est considéré en attente
  leafCount: number // feuilles totales (chapitres potentiels), pour le dénominateur
  anomalies: CompletenessAnomaly[] // feuilles en attente, dans l'ordre du document
  // Répartition des mêmes feuilles sur toute l'échelle (pas seulement les
  // stubs) : `anomalies` en est la vue détaillée des deux premières parts.
  // Une barre par axe de tête, dans l'ordre du document, + le total en
  // dernier. Chaque distribution est ordonnée selon STATUS_SCALE, parts à 0
  // comprises (la légende ne doit pas changer de forme d'un axe à l'autre).
  distribution: CompletenessGroup[]
}

interface NodeCompleteness {
  nodeId: string
  titre: string
  words: number
  isLeaf: boolean
  status: CompletenessStatus // calculé, sans la validation (cf. displayStatus)
  axeId: string // axe de tête dont ce nœud descend (lui-même s'il est racine)
  hash: string // empreinte du texte courant, à comparer à celle de la validation
}

function classify(trame: AxesTree, data: DataMap): NodeCompleteness[] {
  const out: NodeCompleteness[] = []
  const walk = (node: TrameNode, axeId: string) => {
    const item = data[node.id]
    if (item) {
      const stats = computeStats(plainNodeText(item.texte))
      out.push({
        nodeId: node.id,
        titre: item.titre,
        words: stats.mots,
        isLeaf: node.children.length === 0,
        status: stats.status,
        axeId,
        hash: nodeContentHash(item.texte),
      })
    }
    node.children.forEach((child) => walk(child, axeId))
  }
  trame.axes.forEach((axe) => walk(axe, axe.id))
  return out
}

// L'état affiché : la validation de l'utilisateur écrase l'état calculé.
function displayStatus(node: NodeCompleteness, validations: ValidationMap): CompletenessDisplayStatus {
  const validatedHash = validations.get(node.nodeId)
  if (!validatedHash) return node.status
  return validatedHash === node.hash ? 'validé' : 'périmé'
}

function slicesOf(nodes: NodeCompleteness[], validations: ValidationMap): CompletenessSlice[] {
  const statuses = nodes.map((n) => displayStatus(n, validations))
  return STATUS_SCALE.map((status) => ({
    status,
    count: statuses.filter((s) => s === status).length,
  }))
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

export function assessCompleteness(
  trame: AxesTree,
  data: DataMap,
  validations: ValidationMap = new Map(),
): CompletenessAnalysis {
  const nodes = classify(trame, data)
  const leaves = nodes.filter((n) => n.isLeaf)
  // Un chapitre stub que l'utilisateur a validé tel quel n'est pas une
  // anomalie : il a explicitement dit que ce contenu lui convenait. Sans cette
  // exclusion, le même chapitre s'afficherait « validé » dans le graphe et
  // « en attente » dans la table juste à côté.
  const anomalies = leaves
    .filter((n) => isStub(n.status) && displayStatus(n, validations) !== 'validé')
    .map((n) => ({ nodeId: n.nodeId, titre: n.titre, words: n.words, status: n.status as 'vide' | 'ébauche' }))
  // Un axe sans aucune feuille (ni enfant, ni texte propre indexé) n'aurait
  // qu'une barre vide à montrer — on ne lui en fait pas.
  const byAxe: CompletenessGroup[] = trame.axes
    .map((axe) => {
      const own = leaves.filter((n) => n.axeId === axe.id)
      return {
        nodeId: axe.id,
        titre: data[axe.id]?.titre ?? '(sans titre)',
        leafCount: own.length,
        distribution: slicesOf(own, validations),
      }
    })
    .filter((group) => group.leafCount > 0)

  const distribution: CompletenessGroup[] = [
    ...byAxe,
    { nodeId: null, titre: 'Total', leafCount: leaves.length, distribution: slicesOf(leaves, validations) },
  ]

  return { threshold: STUB_MAX_WORDS, leafCount: leaves.length, anomalies, distribution }
}
