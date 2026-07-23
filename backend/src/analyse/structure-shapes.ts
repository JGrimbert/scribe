import { DataMap, TrameNode } from '../import/odt-parser'
import { computeStats } from '../import/odt-parser/text-utils'
import { plainNodeText } from './plain-text'

// La FORME de chaque nœud : la séquence des styles de ses paragraphes, dans
// l'ordre. C'est la matière première des « modèles de structure » — les
// schémas récurrents par niveau (un axe ressemble aux autres axes, un article
// aux autres articles), et la base des règles d'éligibilité par profondeur.
//
// Même nature que completeness.ts / conformity.ts : dérivé du seul contenu,
// calculé au GET, **jamais persisté**. C'est un parcours de tableau, moins cher
// à recalculer qu'à stocker et à invalider.
//
// ── Pourquoi des STYLES et pas des RÔLES ──
// Le tri par rôle est ce qui intéresse in fine, mais il ne se fait PAS ici :
// dans l'écran de typologie, chaque `BaseSelect` change le rôle d'un style en
// direct. Si le backend agrégeait par rôle, il faudrait un aller-retour réseau
// à chaque changement — et l'utilisateur ne verrait pas ses motifs se former à
// mesure qu'il typologise. Le frontend fait la traduction styles → rôles et
// l'agrégation, en réactif (cf. useStructureShapes.js).
//
// ── Pourquoi du RLE ──
// Un article du témoin, c'est ~20 paragraphes ; 900 nœuds × leur séquence
// brute, c'est un payload inutilement gros pour une information très répétitive
// (« corps corps corps corps »). Le run-length encoding la compresse là où elle
// est produite, et rend la signature directement lisible : `[['Paragraphes',
// 4]]` est déjà « corps ×4 ».

type AxesTree = { axes: TrameNode[] }

// [styleName, occurrences consécutives]. Un style vide ('') est possible : un
// paragraphe importé avant que le parseur ne relève les styles.
export type StyleRun = [string, number]

export interface NodeShape {
  nodeId: string
  titre: string
  depth: number
  isLeaf: boolean
  runs: StyleRun[]
  // Caractères du texte PROPRE du nœud (hors enfants), mesurés comme la règle
  // d'éligibilité « au moins N caractères » (conformity.ts). Le frontend écarte
  // des modèles les nœuds sous le seuil du niveau : un article trop court ne
  // définit pas une forme.
  chars: number
  // Couleurs de surlignage portées par ce nœud, dédoublonnées : la présence
  // d'une annotation est un fait binaire par nœud, la compter n'apporte rien à
  // une signature de structure (et la ferait éclater en variantes inutiles).
  highlights: string[]
}

export interface StructureShapes {
  shapes: NodeShape[]
}

const INLINE_MARK_RE = /<mark data-hl="([^"]+)">/g

// Compresse une séquence en runs. Deux paragraphes du même style qui se suivent
// fusionnent ; les mêmes séparés par un autre style restent deux runs — l'ordre
// fait partie de la forme (« chapeau puis corps » n'est pas « corps puis
// chapeau »).
export function toRuns(styleNames: string[]): StyleRun[] {
  const runs: StyleRun[] = []
  for (const name of styleNames) {
    const last = runs[runs.length - 1]
    if (last && last[0] === name) last[1]++
    else runs.push([name, 1])
  }
  return runs
}

function highlightsOf(texte: DataMap[string]['texte']): string[] {
  const colors = new Set<string>()
  for (const entry of texte) {
    if (entry.highlight) colors.add(entry.highlight.toLowerCase())
    const raw = entry.type === 'list' ? entry.items.map((i) => i.text).join('\n') : entry.text
    for (const [, color] of raw.matchAll(INLINE_MARK_RE)) colors.add(color.toLowerCase())
  }
  return [...colors]
}

/**
 * La forme de chaque nœud de l'arbre, dans l'ordre du document.
 *
 * Tous les nœuds, pas seulement les feuilles — contrairement à completeness et
 * conformity : la question posée ici est « à quoi ressemble un axe ? » autant
 * que « à quoi ressemble un article ? ». Un conteneur a une forme propre (son
 * chapeau, son intro), et c'est précisément ce qu'on veut pouvoir exiger de lui.
 */
export function collectShapes(trame: AxesTree, data: DataMap): StructureShapes {
  const shapes: NodeShape[] = []

  const walk = (node: TrameNode, depth: number) => {
    const item = data[node.id]
    if (item) {
      shapes.push({
        nodeId: node.id,
        titre: item.titre,
        depth,
        isLeaf: node.children.length === 0,
        runs: toRuns(item.texte.map((entry) => entry.styleName ?? '')),
        chars: computeStats(plainNodeText(item.texte)).caracteres,
        highlights: highlightsOf(item.texte),
      })
    }
    for (const child of node.children) walk(child, depth + 1)
  }

  for (const axe of trame.axes) walk(axe, 0)

  return { shapes }
}
