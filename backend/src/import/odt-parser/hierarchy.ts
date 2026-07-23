import { FlatNode, ImportCorrections, OutlineFormat, PageStart, ParsedNode, ParsedResult, StyleInventory, TexteEntry, ZoneKey } from './types'
import { makeUniqueSlug, extractRomain, computeStats, stripHtmlTags } from './text-utils'
import { ventilateInventory, zoneOfDepth } from './zones'
import { computeOutlineNumbers } from './outline-numbering'

const EMPTY_INVENTORY: StyleInventory = { styles: [], highlights: [] }

// N'émet que ce qui existe : un `styleName: ''` / `highlight: null` sur chacun
// des ~1800 paragraphes d'un manuscrit, c'est autant de clés vides persistées
// pour ne rien dire.
function styleOf(node: FlatNode): { styleName?: string; highlight?: string; pageStart?: PageStart } {
  // Le style porté par un <text:list> est un style de LISTE (« L1 ») : il ne
  // dit rien de ce qu'est ce texte, et n'existe pas dans l'inventaire — qui ne
  // compte que les paragraphes et les titres. Ce qui a un sens, c'est le style
  // des paragraphes des items (« Puces ? »). Sans cette substitution, une liste
  // porte en base un nom de style que la typologie ne peut pas arbitrer, et qui
  // ressort en trou dans les signatures de structure.
  const styleName = node.kind === 'list' ? (node.innerStyles?.[0] ?? '') : node.effectiveStyle
  return {
    ...(styleName ? { styleName } : {}),
    ...(node.highlight ? { highlight: node.highlight } : {}),
    ...(node.pageStart ? { pageStart: node.pageStart } : {}),
  }
}

// Un FlatNode tel qu'il se range dans le liminaire ou le final : ces zones ne
// sont pas de la structure, tout y est aplati en entrées de texte — un titre y
// est un paragraphe comme un autre. Rend `null` pour ce qui n'a rien à y dire
// (tableau, entrée vide).
function matterEntryOf(node: FlatNode): TexteEntry | null {
  if (node.kind === 'table') return null
  if (node.kind === 'list') {
    const items = node.listItems ?? []
    return items.length ? { type: 'list', ordered: node.listOrdered ?? false, items, ...styleOf(node) } : null
  }
  return node.text ? { type: 'paragraph', text: node.text, ...styleOf(node) } : null
}

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
  // Ne se déduit pas de flatNodes : l'inventaire doit voir les paragraphes
  // internes aux tableaux, que la passe 1 aplatit en données (cf.
  // inventory.ts). Il vient donc de buildFlatNodes, qui a lu le XML.
  inventory: StyleInventory = EMPTY_INVENTORY,
  // Format de numérotation des titres (`<text:outline-style>`). Calculé sur les
  // niveaux BRUTS et l'ordre document — indépendant des corrections, comme
  // LibreOffice qui numérote sans les connaître.
  outlineFormat: OutlineFormat | null = null,
): { result: ParsedResult; bookmarks: Map<string, ParsedNode> } {
  const structureStartIndex = corrections?.structureStartIndex ?? 0
  const structureEndIndex = corrections?.structureEndIndex
  const levelOverrides = corrections?.levelOverrides ?? {}
  const outlineNumbers = computeOutlineNumbers(flatNodes, outlineFormat)

  const result: ParsedResult = {
    inventory,
    meta: {
      parsedAt: new Date().toISOString(),
      totalNodes: flatNodes.length,
      totalArticles: 0,
      totalBlocs: 0,
      totalAxes: 0,
      maxDepth: 0,
      paragraphesLiminaire: 0,
      paragraphesFinal: 0,
      sectionsRencontrees: 0,
      titresVides: 0,
      ...meta,
    },
    liminaire: [],
    final: [],
    axes: [],
  }

  const stack: ParsedNode[] = []
  const slugsByParent = new Map<ParsedNode | null, Set<string>>()
  const bookmarkToParsedNode = new Map<string, ParsedNode>()
  // La zone de chaque FlatNode, relevée au fil de CETTE pile — la seule qui
  // fasse autorité sur la profondeur (cf. zones.ts).
  const zones = new Map<number, ZoneKey>()
  let titresVides = 0
  let paragraphesLiminaire = 0
  let paragraphesFinal = 0

  function slugsFor(parent: ParsedNode | null): Set<string> {
    let s = slugsByParent.get(parent)
    if (!s) {
      s = new Set()
      slugsByParent.set(parent, s)
    }
    return s
  }

  // « plain » au sens strict : les marqueurs (<a data-bookmark>, <mark
  // data-hl>) doivent tomber, sinon computeStats les compte comme des mots et
  // gonfle les stats du livre.
  function entryPlainText(entry: TexteEntry): string {
    const raw = entry.type === 'list' ? entry.items.map((item) => item.text).join('\n') : entry.text
    return stripHtmlTags(raw)
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

  // La zone du contenu courant : celle du dernier titre ouvert. Sans titre
  // ouvert, on est encore avant la structure — donc en liminaire, exactement là
  // où ce contenu est rangé quelques lignes plus bas.
  function currentZone(): ZoneKey {
    return stack.length ? zoneOfDepth(stack.length - 1) : 'liminaire'
  }

  for (const node of flatNodes) {
    if (node.index < structureStartIndex) {
      zones.set(node.index, 'liminaire')
      // Pages blanches précédant ce nœud : entrées structurantes, pas du contenu
      // — on ne les compte donc pas dans paragraphesLiminaire.
      for (const side of node.blanksBefore ?? []) result.liminaire.push({ type: 'paragraph', text: '', pageStart: side })
      const entry = matterEntryOf(node)
      if (entry) {
        paragraphesLiminaire++
        result.liminaire.push(entry)
      }
      continue
    }

    if (structureEndIndex != null && node.index >= structureEndIndex) {
      zones.set(node.index, 'final')
      for (const side of node.blanksBefore ?? []) result.final.push({ type: 'paragraph', text: '', pageStart: side })
      const entry = matterEntryOf(node)
      if (entry) {
        paragraphesFinal++
        result.final.push(entry)
      }
      continue
    }

    if (node.kind === 'table') {
      zones.set(node.index, currentZone())
      const current = stack[stack.length - 1]
      if (current) current.tableau = node.tableData ?? null
      continue
    }

    if (node.kind === 'list') {
      zones.set(node.index, currentZone())
      const items = node.listItems ?? []
      const current = stack[stack.length - 1]
      if (current) {
        current.texte.push({ type: 'list', ordered: node.listOrdered ?? false, items, ...styleOf(node) })
      } else {
        // Aucun titre encore ouvert : du contenu qui traîne avant le premier
        // titre du corps. Il rejoint le liminaire, faute de nœud à qui
        // l'attacher.
        const entry = matterEntryOf(node)
        if (entry) {
          paragraphesLiminaire++
          result.liminaire.push(entry)
        }
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
        // Style effectif du titre (pour le rendu fidèle Folio) et son numéro de
        // chapitre auto — calculé sur le niveau BRUT du titre, pas l'override.
        styleName: node.effectiveStyle || null,
        outlineNumber: outlineNumbers.get(node.index) ?? null,
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
      // Après le push : un titre appartient à SA propre profondeur, pas à celle
      // de son parent.
      zones.set(node.index, currentZone())
      continue
    }

    // level === 0 : simple paragraphe, ou titre explicitement "ignoré"
    // (levelOverrides[node.index] === 0) — même traitement, comme contenu
    // du nœud actuellement ouvert.
    if (!text) continue

    zones.set(node.index, currentZone())

    const current = stack[stack.length - 1]
    if (current) {
      // Ces deux heuristiques ne font plus autorité : elles ne tenaient que
      // sur des noms de styles bruts (« P26 » ne dit rien) et n'étaient pas
      // corrigeables. Elles restent ici pour ne pas vider `citations`/`pistes`
      // des documents déjà importés, mais la vérité est désormais dans
      // styleName + highlight, arbitrés par la typologie du document.
      if (/citation|quote/i.test(node.effectiveStyle) || text.startsWith('«') || text.startsWith('"')) {
        current.citations.push(text)
      }
      if (node.highlight) {
        current.pistes.push(text)
      }
      current.texte.push({ type: 'paragraph', text, ...styleOf(node) })
    } else {
      paragraphesLiminaire++
      result.liminaire.push({ type: 'paragraph', text, ...styleOf(node) })
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
  result.meta.paragraphesLiminaire = paragraphesLiminaire
  result.meta.paragraphesFinal = paragraphesFinal

  // La ventilation est le seul volet de l'inventaire qui dépende des
  // corrections de calibration : les comptes viennent du XML, les zones de la
  // pile ci-dessus. D'où un inventaire qui ne se fige qu'ici, et pas au preview.
  result.inventory = ventilateInventory(inventory, flatNodes, zones)
  result.meta.sectionsRencontrees = sectionsRencontrees
  result.meta.titresVides = titresVides

  return { result, bookmarks: bookmarkToParsedNode }
}
