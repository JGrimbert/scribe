import { randomUUID } from 'crypto'
import { DataMap, HarmonizedItem, ParsedNode, ParsedResult, Stats, Trame, TrameNode } from './types'

// ─── Harmonisation (port de harmonize.js) ─────────────────────────────────
function buildConnexe(tableau: string[][] | null, pistes: string[]): HarmonizedItem['connexe'] {
  const hasTableau = !!tableau
  const hasPistes = pistes.length > 0
  if (!hasTableau && !hasPistes) return null
  return { tableau: tableau || null, pistes }
}

function cleanStats(stats: Stats | null): HarmonizedItem['stats'] {
  if (!stats) return null
  const { status, paragraphes, ...rest } = stats
  return rest
}

// Signets non résolus (référençant un titre qui n'existe pas encore, ou plus)
// : attendu sur un document en construction, pas une erreur — le lien est
// laissé en texte brut plutôt que de faire échouer l'import.
const BOOKMARK_LINK_RE = /<a data-bookmark="([^"]+)">([\s\S]*?)<\/a>/g

function resolveLinksInText(text: string, bookmarkNameToId: Map<string, string>): string {
  return text.replace(BOOKMARK_LINK_RE, (_match, name: string, inner: string) => {
    const targetId = bookmarkNameToId.get(name)
    if (!targetId) {
      console.warn(`[odt-parser] signet interne introuvable : "${name}" (lien laissé en texte brut)`)
      return inner
    }
    return `<a href="internal:${targetId}" class="lien-interne">${inner}</a>`
  })
}

function resolveInternalLinks(data: DataMap, bookmarkNameToId: Map<string, string>) {
  for (const item of Object.values(data)) {
    item.texte = item.texte.map((entry) =>
      entry.type === 'list'
        ? { ...entry, items: entry.items.map((it) => ({ ...it, text: resolveLinksInText(it.text, bookmarkNameToId) })) }
        : { ...entry, text: resolveLinksInText(entry.text, bookmarkNameToId) },
    )
    if (item.connexe?.tableau) {
      item.connexe.tableau = item.connexe.tableau.map((row) => row.map((cell) => resolveLinksInText(cell, bookmarkNameToId)))
    }
  }
}

export function harmonize(result: ParsedResult, bookmarks?: Map<string, ParsedNode>): { data: DataMap; trame: Trame } {
  const data: DataMap = {}

  // Inversion une fois : ParsedNode -> noms de signets qui lui sont rattachés
  // (un même titre peut porter plusieurs signets).
  const bookmarkNamesByNode = new Map<ParsedNode, string[]>()
  for (const [name, node] of bookmarks ?? []) {
    const names = bookmarkNamesByNode.get(node)
    if (names) names.push(name)
    else bookmarkNamesByNode.set(node, [name])
  }
  const bookmarkNameToId = new Map<string, string>()

  function addNode(node: ParsedNode, level: number): TrameNode {
    const id = randomUUID()
    for (const name of bookmarkNamesByNode.get(node) ?? []) {
      bookmarkNameToId.set(name, id)
    }
    data[id] = {
      id,
      level,
      titre: node.titre,
      slug: node.slug,
      styleName: node.styleName,
      outlineNumber: node.outlineNumber,
      texte: node.texte,
      connexe: buildConnexe(node.tableau, node.pistes),
      indexGlobal: node.indexGlobal,
      stats: cleanStats(node.stats),
    }
    return { id, children: node.children.map((c) => addNode(c, level + 1)) }
  }

  const trame: Trame = {
    meta: result.meta,
    liminaire: result.liminaire,
    final: result.final,
    axes: result.axes.map((a) => addNode(a, 0)),
  }

  resolveInternalLinks(data, bookmarkNameToId)

  return { data, trame }
}
