/**
 * Port de Marvarid/parser/parse.js + harmonize.js.
 * Logique volontairement proche (mêmes règles de détection de titres, mêmes
 * styles de métadonnées, même calcul de stats) — avec deux différences
 * assumées par rapport à l'original : lecture depuis un Buffer en mémoire
 * (upload multipart) plutôt qu'un fichier disque, et une hiérarchie de
 * titres à profondeur arbitraire (voir ParsedNode) plutôt que les 3 niveaux
 * figés axe/bloc/article — un ODT n'a pas cette notion nativement (juste des
 * text:outline-level 1..10), c'est Marvarid qui l'imposait artificiellement.
 */
import * as unzipper from 'unzipper'
import { DOMParser } from 'xmldom'
import * as xpath from 'xpath'
import { randomUUID } from 'crypto'

const NS = {
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
}
const select = xpath.useNamespaces(NS)

const META_STYLES = {
  auteur: ['auteur', 'P301'],
  titreLivre: ['titre principal', 'P197'],
}

export interface Stats {
  mots: number
  caracteres: number
  paragraphes: number
  status: 'vide' | 'ébauche' | 'partiel' | 'rédigé'
}

// Un item de liste ODT (text:list-item), à plat : `depth` (0 = premier
// niveau) remplace l'imbrication réelle des <text:list> ODT — convention
// alignée sur celle de Quill 2 pour les listes imbriquées (classes
// `ql-indent-N` sur des <li> à plat, jamais de <ul>/<ol> imbriqués), pour
// que le format round-trip sans traduction supplémentaire côté édition.
export interface ListItemEntry {
  text: string
  depth: number
}

// Une entrée de `texte[]` : soit un paragraphe simple (comportement
// historique), soit une liste entière (tous ses items) traitée comme UN
// seul bloc — cf. backend/CLAUDE.md et le plan "Articles par nœud" pour la
// justification (minimise l'impact sur la logique de fusion/split
// frontend, qui reste par-entrée).
export type TexteEntry = { type: 'paragraph'; text: string } | { type: 'list'; ordered: boolean; items: ListItemEntry[] }

// Un nœud de titre, à n'importe quelle profondeur (remplace les anciens
// ParsedAxe/ParsedBloc/ParsedArticle distincts). `texte` est le contenu
// propre à ce nœud, avant son premier enfant ; `children` porte la suite de
// la hiérarchie.
export interface ParsedNode {
  titre: string
  slug: string
  numeroRomain: string | null
  texte: TexteEntry[]
  citations: string[]
  pistes: string[]
  tableau: string[][] | null
  children: ParsedNode[]
  stats: Stats | null
  indexGlobal: number | null
}

export interface ParsedResult {
  meta: {
    parsedAt: string
    totalNodes: number
    auteur?: string
    titreLivre?: string
    totalArticles: number // nœuds de profondeur >= 2 (généralisation : "tout ce qui est sous un bloc")
    totalBlocs: number // nœuds de profondeur 1
    totalAxes: number // nœuds racine (profondeur 0)
    maxDepth: number
    paragraphesPreambule: number
    sectionsRencontrees: number
    titresVides: number
  }
  preambule: string[]
  axes: ParsedNode[]
}

export interface HarmonizedItem {
  id: string
  level: number // profondeur (0 = racine), remplace l'ancien type 'axe'|'bloc'|'article'
  titre: string
  slug: string
  texte: TexteEntry[]
  connexe: { tableau: string[][] | null; pistes: string[] } | null
  indexGlobal: number | null
  stats: Omit<Stats, 'status' | 'paragraphes'> | null
}

export type DataMap = Record<string, HarmonizedItem>

export interface TrameNode {
  id: string
  children: TrameNode[]
}

export interface Trame {
  meta: ParsedResult['meta']
  preambule: string[]
  axes: TrameNode[]
}

export interface OdtParseOutput {
  result: ParsedResult
  data: DataMap
  trame: Trame
}

// ─── Calibration : titres candidats + corrections utilisateur ─────────────
//
// La détection automatique du niveau de titre (headingLevel, cf. plus bas)
// se fie au nom du style ODT (Titre 1/2/3, Heading 1/2/3). Sur un document
// réel où certains titres sont mis en forme directement (styles "Pxxx"
// auto-générés par LibreOffice) plutôt que via un style nommé, cette
// détection peut se tromper silencieusement (un axe entier rétrogradé en
// bloc). FlatNode/OutlineEntry séparent donc la lecture du XML (une seule
// fois) de la construction de la structure imbriquée, pour permettre de
// rejouer cette dernière avec des corrections manuelles sans re-parser le
// fichier.
export interface FlatNode {
  index: number
  kind: 'heading' | 'paragraph' | 'table' | 'list'
  level: number // détecté automatiquement ; seulement pertinent si kind === 'heading'
  text: string
  styleName: string
  hasPageBreak: boolean // fo:break-before forcé sur le style de ce nœud
  tableData?: string[][]
  listItems?: ListItemEntry[] // pertinent si kind === 'list'
  listOrdered?: boolean // pertinent si kind === 'list'
}

export interface OutlineEntry {
  index: number
  level: number
  text: string
  empty: boolean
  hasPageBreak: boolean
}

export interface ImportCorrections {
  // Index (dans FlatNode[]) du premier nœud appartenant à la vraie structure.
  // Tout ce qui précède (page de titre, auteur, sommaire...) part en
  // préambule, quel que soit le niveau de titre détecté dessus.
  structureStartIndex: number
  // Niveau corrigé pour un titre mal détecté, par index de FlatNode.
  // 0 = "ignorer" (rétrograder en simple paragraphe).
  levelOverrides?: Record<number, number>
}

// ─── Lire le content.xml depuis un .odt (ZIP) en mémoire ──────────────────
export async function readOdtContentXml(buffer: Buffer): Promise<string> {
  const directory = await unzipper.Open.buffer(buffer)
  const entry = directory.files.find((f) => f.path === 'content.xml')
  if (!entry) throw new Error('content.xml non trouvé dans le ODT')
  const content = await entry.buffer()
  return content.toString('utf-8')
}

// ─── Extraire le texte brut d'un nœud (récursif) ──────────────────────────
function nodeText(node: any): string {
  if (!node) return ''
  if (node.nodeType === 3) return node.nodeValue || ''
  let text = ''
  const children = node.childNodes
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.localName === 'line-break') {
      text += '\n'
      continue
    }
    if (child.localName === 'tab') {
      text += '\t'
      continue
    }
    if (child.localName === 's') {
      const c = parseInt(child.getAttribute('text:c') || '1', 10)
      text += ' '.repeat(c)
      continue
    }
    text += nodeText(child)
  }
  return text
}

function headingLevel(paraNode: any): number {
  if (paraNode.localName === 'h') {
    const outlineLevel = paraNode.getAttribute('text:outline-level')
    if (outlineLevel) return parseInt(outlineLevel, 10)
    return 1
  }
  const styleName = paraNode.getAttribute('text:style-name') || ''
  if (/^(Titre|Titre_20_|Heading|Heading_20_)\s*1$/i.test(styleName)) return 1
  if (/^(Titre|Titre_20_|Heading|Heading_20_)\s*2$/i.test(styleName)) return 2
  if (/^(Titre|Titre_20_|Heading|Heading_20_)\s*3$/i.test(styleName)) return 3
  const ol = paraNode.getAttribute('text:outline-level')
  if (ol) return parseInt(ol, 10)
  return 0
}

// Styles dont la propriété de paragraphe force un saut de page (fo:break-before,
// valeur "page"/"left"/"right"/"even"/"odd" — tout sauf absent/"auto"). Un
// titre dont le style porte cette surcharge démarre visuellement comme un
// axe, même si son niveau sémantique (outline-level) dit autre chose —
// signal utile pour repérer un titre probablement mal classé.
function buildPageBreakStyles(doc: any): Set<string> {
  const styleNodes = select('//*[local-name()="automatic-styles"]/*[local-name()="style"]', doc) as any[]
  const styles = new Set<string>()
  for (const styleNode of styleNodes) {
    const name = styleNode.getAttribute('style:name')
    if (!name) continue
    const propsNodes = select('*[local-name()="paragraph-properties"]', styleNode) as any[]
    const hasBreak = propsNodes.some((p: any) => {
      const v = p.getAttribute('fo:break-before')
      return v && v !== 'auto'
    })
    if (hasBreak) styles.add(name)
  }
  return styles
}

// Styles de liste (text:list-style, dans automatic-styles ET styles — un
// style de liste réutilisé délibérément est souvent nommé et rangé dans
// office:styles plutôt qu'auto-généré). Ne retient que la distinction
// numéroté/à puces (premier niveau) : les nuances (romain, lettré, puce
// personnalisée) sont laissées à un rendu cosmétique côté frontend, pas
// portées par Quill de toute façon (cf. plan "Articles par nœud").
function buildListStyles(doc: any): Map<string, boolean> {
  const styleNodes = select(
    '//*[local-name()="automatic-styles" or local-name()="styles"]/*[local-name()="list-style"]',
    doc,
  ) as any[]
  const ordered = new Map<string, boolean>()
  for (const styleNode of styleNodes) {
    const name = styleNode.getAttribute('style:name')
    if (!name) continue
    const hasNumberLevel = (select('*[local-name()="list-level-style-number"]', styleNode) as any[]).length > 0
    ordered.set(name, hasNumberLevel)
  }
  return ordered
}

// Aplatit un <text:list> en items { text, depth } — une sous-liste imbriquée
// dans un text:list-item incrémente juste `depth`, pas de structure
// récursive (cf. ListItemEntry).
function extractListItems(listNode: any, depth: number, items: ListItemEntry[]) {
  const itemNodes = select('text:list-item', listNode) as any[]
  for (const itemNode of itemNodes) {
    const children = itemNode.childNodes
    const textParts: string[] = []
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType !== 1) continue
      if (child.localName === 'p' || child.localName === 'h') {
        const t = nodeText(child).trim()
        if (t) textParts.push(t)
      }
    }
    if (textParts.length) items.push({ text: textParts.join(' '), depth })

    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType === 1 && child.localName === 'list') {
        extractListItems(child, depth + 1, items)
      }
    }
  }
}

// Extrait le texte des lignes de la table des matières (si présente), pour
// aider à repérer où la vraie structure démarre : le liminaire (page de
// titre, auteur...) n'y figure normalement pas.
function extractTocTexts(doc: any): string[] {
  const tocParagraphs = select('//*[local-name()="table-of-content"]//*[local-name()="index-body"]//*[local-name()="p"]', doc) as any[]
  return tocParagraphs
    .map((p) => nodeText(p).split('\t')[0].trim()) // coupe avant la tabulation + numéro de page
    .filter(Boolean)
}

function extractTable(tableNode: any): string[][] {
  const rows = select('.//table:table-row', tableNode) as any[]
  return rows.map((row) => {
    const cells = select('table:table-cell', row) as any[]
    return cells.map((cell) => {
      const paras = select('text:p', cell) as any[]
      return paras.map(nodeText).join('\n').trim()
    })
  })
}

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g')

function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function makeUniqueSlug(text: string, usedSlugs: Set<string>, fallbackPrefix: string): string {
  const base = slugify(text) || fallbackPrefix
  let slug = base
  let i = 2
  while (usedSlugs.has(slug)) {
    slug = `${base}-${i}`
    i++
  }
  usedSlugs.add(slug)
  return slug
}

function extractRomain(titre: string): string | null {
  const match = titre.match(/\b(M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3}))\b/i)
  return match ? match[1].toUpperCase() : null
}

function computeStats(text: string): Stats {
  const mots = text.trim().split(/\s+/).filter(Boolean).length
  const caracteres = text.replace(/\s/g, '').length
  const paragraphes = text.split(/\n\n+/).filter((p) => p.trim()).length
  const status: Stats['status'] = mots === 0 ? 'vide' : mots < 50 ? 'ébauche' : mots < 200 ? 'partiel' : 'rédigé'
  return { mots, caracteres, paragraphes, status }
}

// ─── Passe 1 : lecture du XML → liste plate de nœuds classés ──────────────
// Ne fait aucune hypothèse sur la structure finale : se contente de classer
// chaque nœud (titre détecté / paragraphe / tableau) dans l'ordre du
// document. C'est la passe 2 (buildParsedResult) qui décide, à partir de
// cette liste, comment construire la hiérarchie — et peut être rejouée avec
// des corrections sans revenir au XML.
function buildFlatNodes(xmlContent: string): {
  flatNodes: FlatNode[]
  meta: { auteur?: string; titreLivre?: string }
  sectionsRencontrees: number
  tocTexts: string[]
} {
  const doc = new DOMParser().parseFromString(xmlContent, 'text/xml')

  const officeNS = { office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0', ...NS }
  const selectFull = xpath.useNamespaces(officeNS)
  const body =
    (selectFull('//office:body/office:text', doc) as any[])[0] ||
    (selectFull('//office:text', doc) as any[])[0] ||
    (select('//*[local-name()="text"]', doc) as any[])[0]

  if (!body) throw new Error('Impossible de trouver le corps du document ODT')

  const pageBreakStyles = buildPageBreakStyles(doc)
  const listStyles = buildListStyles(doc)
  const tocTexts = extractTocTexts(doc)

  const rawNodes: any[] = []
  let sectionsRencontrees = 0
  function flatten(parent: any) {
    const children = parent.childNodes
    for (let i = 0; i < children.length; i++) {
      const node = children[i]
      if (node.nodeType !== 1) continue
      if (node.localName === 'section') {
        sectionsRencontrees++
        flatten(node)
      } else if (node.localName === 'table-of-content') {
        // déjà extrait ci-dessus (extractTocTexts) — ne pas le traiter comme
        // du contenu normal, sous peine de dupliquer les titres qu'il liste.
        continue
      } else {
        rawNodes.push(node)
      }
    }
  }
  flatten(body)

  const flatNodes: FlatNode[] = []
  const meta: { auteur?: string; titreLivre?: string } = {}

  for (const node of rawNodes) {
    const localName = node.localName

    if (localName === 'list') {
      const items: ListItemEntry[] = []
      extractListItems(node, 0, items)
      if (items.length) {
        const styleName = node.getAttribute('text:style-name') || ''
        flatNodes.push({
          index: flatNodes.length,
          kind: 'list',
          level: 0,
          text: '',
          styleName,
          hasPageBreak: false,
          listItems: items,
          listOrdered: listStyles.get(styleName) ?? false,
        })
      }
      continue
    }

    if (localName === 'p' || localName === 'h') {
      const styleName = node.getAttribute('text:style-name') || ''

      if (META_STYLES.auteur.includes(styleName)) {
        const t = nodeText(node).trim()
        if (t && !meta.auteur) meta.auteur = t
        continue
      }
      if (META_STYLES.titreLivre.includes(styleName)) {
        const t = nodeText(node).trim()
        if (t && !meta.titreLivre) meta.titreLivre = t
        continue
      }

      const level = headingLevel(node)
      const text = nodeText(node).trim()
      const hasPageBreak = pageBreakStyles.has(styleName)

      if (level >= 1) {
        flatNodes.push({ index: flatNodes.length, kind: 'heading', level, text, styleName, hasPageBreak })
      } else if (text) {
        flatNodes.push({ index: flatNodes.length, kind: 'paragraph', level: 0, text, styleName, hasPageBreak })
      }
      continue
    }

    if (localName === 'table') {
      flatNodes.push({
        index: flatNodes.length,
        kind: 'table',
        level: 0,
        text: '',
        styleName: '',
        hasPageBreak: false,
        tableData: extractTable(node),
      })
    }
  }

  return { flatNodes, meta, sectionsRencontrees, tocTexts }
}

// ─── Aperçu pour calibration : les titres détectés, pour validation ───────
export function buildOutline(flatNodes: FlatNode[]): OutlineEntry[] {
  return flatNodes
    .filter((n) => n.kind === 'heading' && n.text)
    .map((n) => ({ index: n.index, level: n.level, text: n.text, empty: !n.text, hasPageBreak: n.hasPageBreak }))
}

// ─── Suggestion du point de départ de la structure ────────────────────────
// Le liminaire (page de titre, auteur, sommaire...) ne figure normalement
// pas dans la table des matières — le premier titre du corps qui y apparaît
// aussi est donc un excellent candidat pour marquer où la vraie structure
// commence. Simple correspondance par suffixe : une ligne de table des
// matières porte souvent une numérotation devant le titre ("1.Sylvestres"),
// jamais après.
export function suggestStructureStartIndex(outline: OutlineEntry[], tocTexts: string[]): number {
  if (!outline.length || !tocTexts.length) return outline[0]?.index ?? 0
  const found = outline.find((entry) => entry.text.length >= 3 && tocTexts.some((t) => t.endsWith(entry.text)))
  return found?.index ?? outline[0]?.index ?? 0
}

// ─── Passe 2 : construction de la hiérarchie à profondeur arbitraire ──────
// `level` (1-indexé, comme text:outline-level) pilote juste "combien
// d'ancêtres actuellement ouverts refermer" — la profondeur RÉELLE d'un
// nœud est sa position dans la pile au moment où il est empilé, pas une
// correspondance stricte au numéro de niveau. Un document qui saute un
// niveau (ex: un Titre 1 suivi directement d'un Titre 3) imbrique
// simplement le second sous le premier, sans créer de nœud fantôme
// intermédiaire.
function buildParsedResult(
  flatNodes: FlatNode[],
  meta: { auteur?: string; titreLivre?: string },
  sectionsRencontrees: number,
  corrections?: ImportCorrections,
): ParsedResult {
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
      stack.push({
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
      })
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

  return result
}

// ─── Parser principal ─────────────────────────────────────────────────────
export function parseOdtXml(xmlContent: string, corrections?: ImportCorrections): ParsedResult {
  const { flatNodes, meta, sectionsRencontrees } = buildFlatNodes(xmlContent)
  return buildParsedResult(flatNodes, meta, sectionsRencontrees, corrections)
}

// ─── Aperçu (calibration) : parse sans construire la structure finale ─────
export function parseOdtXmlForPreview(
  xmlContent: string,
): { flatNodes: FlatNode[]; outline: OutlineEntry[]; suggestedStructureStartIndex: number } {
  const { flatNodes, tocTexts } = buildFlatNodes(xmlContent)
  const outline = buildOutline(flatNodes)
  return { flatNodes, outline, suggestedStructureStartIndex: suggestStructureStartIndex(outline, tocTexts) }
}

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

export function harmonize(result: ParsedResult): { data: DataMap; trame: Trame } {
  const data: DataMap = {}

  function addNode(node: ParsedNode, level: number): TrameNode {
    const id = randomUUID()
    data[id] = {
      id,
      level,
      titre: node.titre,
      slug: node.slug,
      texte: node.texte,
      connexe: buildConnexe(node.tableau, node.pistes),
      indexGlobal: node.indexGlobal,
      stats: cleanStats(node.stats),
    }
    return { id, children: node.children.map((c) => addNode(c, level + 1)) }
  }

  const trame: Trame = {
    meta: result.meta,
    preambule: result.preambule,
    axes: result.axes.map((a) => addNode(a, 0)),
  }

  return { data, trame }
}

export async function parseOdtBuffer(buffer: Buffer, corrections?: ImportCorrections): Promise<OdtParseOutput> {
  const xmlContent = await readOdtContentXml(buffer)
  const result = parseOdtXml(xmlContent, corrections)
  const { data, trame } = harmonize(result)
  return { result, data, trame }
}

export async function parseOdtBufferForPreview(
  buffer: Buffer,
): Promise<{ flatNodes: FlatNode[]; outline: OutlineEntry[]; suggestedStructureStartIndex: number }> {
  const xmlContent = await readOdtContentXml(buffer)
  return parseOdtXmlForPreview(xmlContent)
}
