import { FlatNode, ImportCorrections, ParsedNode, ParsedResult, TexteEntry } from './types'
import { makeUniqueSlug, extractRomain, computeStats } from './text-utils'

// ─── Passe 2 : construction de la hiérarchie à profondeur arbitraire ──────
// `level` (1-indexé, comme text:outline-level) pilote juste "combien
// d'ancêtres actuellement ouverts refermer" — la profondeur RÉELLE d'un
// nœud est sa position dans la pile au moment où il est empilé, pas une
// correspondance stricte au numéro de niveau. Un document qui saute un
// niveau (ex: un Titre 1 suivi directement d'un Titre 3) imbrique
// simplement le second sous le premier, sans créer de nœud fantôme
// intermédiaire.
export function buildParsedResult(
  flatNodes: FlatNode[],
  meta: { auteur?: string; titreLivre?: string },
  sectionsRencontrees: number,
  corrections?: ImportCorrections,
): { result: ParsedResult; bookmarks: Map<string, ParsedNode> } {
  const structureStartIndex = corrections?.structureStartIndex ?? 0
  const levelOverrides = corrections?.levelOverrides ?? {}

  const result: ParsedResult = {
    meta: {
      parsedAt: new Date().toISOString(),
      totalNodes: flatNodes.length,
      totalArticles: 0,
      totalBlocs: 0,
      totalAxes: 0,
      maxDepth: 0,
      paragraphesPreambule: 0,
      sectionsRencontrees: 0,
      titresVides: 0,
      ...meta,
    },
    preambule: [],
    axes: [],
  }

  const stack: ParsedNode[] = []
  const slugsByParent = new Map<ParsedNode | null, Set<string>>()
  const bookmarkToParsedNode = new Map<string, ParsedNode>()
  let titresVides = 0
  let paragraphesPreambule = 0

  function slugsFor(parent: ParsedNode | null): Set<string> {
    let s = slugsByParent.get(parent)
    if (!s) {
      s = new Set()
      slugsByParent.set(parent, s)
    }
    return s
  }

  function entryPlainText(entry: TexteEntry): string {
    return entry.type === 'list' ? entry.items.map((item) => item.text).join('\n') : entry.text
  }

  function fullText(node: ParsedNode): string {
    return [node.texte.map(entryPlainText).join('\n'), ...node.children.map(fullText)].join('\n')
  }

  function closeTo(level: number) {
    while (stack.length >= level) {
      const node = stack.pop() as ParsedNode
      node.stats = computeStats(fullText(node))
      const parent = stack[stack.length - 1] ?? null
      if (parent) parent.children.push(node)
      else result.axes.push(node)
    }
  }

  for (const node of flatNodes) {
    if (node.index < structureStartIndex) {
      if (node.kind !== 'table' && node.text) {
        paragraphesPreambule++
        result.preambule.push(node.text)
      }
      continue
    }

    if (node.kind === 'table') {
      const current = stack[stack.length - 1]
      if (current) current.tableau = node.tableData ?? null
      continue
    }

    if (node.kind === 'list') {
      const items = node.listItems ?? []
      const current = stack[stack.length - 1]
      if (current) {
        current.texte.push({ type: 'list', ordered: node.listOrdered ?? false, items })
      } else {
        paragraphesPreambule++
        result.preambule.push(items.map((item) => item.text).join('\n'))
      }
      continue
    }

    const level = node.kind === 'heading' ? (levelOverrides[node.index] ?? node.level) : 0
    const text = node.text

    if (level >= 1) {
      closeTo(level)
      if (!text) titresVides++
      const parent = stack[stack.length - 1] ?? null
      const slug = makeUniqueSlug(text, slugsFor(parent), `titre-${(parent?.children.length ?? result.axes.length) + 1}`)
      const newNode: ParsedNode = {
        titre: text,
        slug,
        numeroRomain: extractRomain(text),
        texte: [],
        citations: [],
        pistes: [],
        tableau: null,
        children: [],
        stats: null,
        indexGlobal: null,
      }
      for (const name of node.bookmarkNames ?? []) {
        bookmarkToParsedNode.set(name, newNode)
      }
      stack.push(newNode)
      continue
    }

    // level === 0 : simple paragraphe, ou titre explicitement "ignoré"
    // (levelOverrides[node.index] === 0) — même traitement, comme contenu
    // du nœud actuellement ouvert.
    if (!text) continue

    const current = stack[stack.length - 1]
    if (current) {
      if (/citation|quote/i.test(node.styleName) || text.startsWith('«') || text.startsWith('"')) {
        current.citations.push(text)
      }
      if (/highlight|surlign/i.test(node.styleName)) {
        current.pistes.push(text)
      }
      current.texte.push({ type: 'paragraph', text })
    } else {
      paragraphesPreambule++
      result.preambule.push(text)
    }
  }

  closeTo(1)

  let globalIndex = 1
  function assignIndex(node: ParsedNode) {
    if (node.children.length === 0) {
      node.indexGlobal = globalIndex++
    } else {
      node.children.forEach(assignIndex)
    }
  }
  result.axes.forEach(assignIndex)

  let totalBlocs = 0
  let totalArticles = 0
  let maxDepth = 0
  function countByDepth(node: ParsedNode, depth: number) {
    maxDepth = Math.max(maxDepth, depth)
    if (depth === 1) totalBlocs++
    else if (depth >= 2) totalArticles++
    node.children.forEach((c) => countByDepth(c, depth + 1))
  }
  result.axes.forEach((a) => countByDepth(a, 0))

  result.meta.totalArticles = totalArticles
  result.meta.totalBlocs = totalBlocs
  result.meta.totalAxes = result.axes.length
  result.meta.maxDepth = maxDepth
  result.meta.paragraphesPreambule = paragraphesPreambule
  result.meta.sectionsRencontrees = sectionsRencontrees
  result.meta.titresVides = titresVides

  return { result, bookmarks: bookmarkToParsedNode }
}
