/**
 * Port de Marvarid/parser/parse.js + harmonize.js.
 * Logique volontairement identique (mêmes règles de détection de titres,
 * mêmes styles de métadonnées, même calcul de stats) — seule différence :
 * lecture depuis un Buffer en mémoire (upload multipart) plutôt qu'un fichier
 * disque, et aucune écriture de fichier ici (pur, testable sans I/O).
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

export interface ParsedArticle {
  titre: string
  slug: string
  numeroRomain: string | null
  paragraphes: string[]
  citations: string[]
  pistes: string[]
  tableauRenvois: string[][] | null
  stats: Stats | null
  indexGlobal?: number
}

export interface ParsedBloc {
  titre: string
  slug: string
  intro: string[]
  tableau: string[][] | null
  articles: ParsedArticle[]
  stats: Stats | null
}

export interface ParsedAxe {
  titre: string
  slug: string
  intro: string[]
  blocs: ParsedBloc[]
  stats: Stats | null
}

export interface ParsedResult {
  meta: {
    parsedAt: string
    totalNodes: number
    auteur?: string
    titreLivre?: string
    totalArticles: number
    totalBlocs: number
    totalAxes: number
    paragraphesPreambule: number
    sectionsRencontrees: number
    titresVides: number
  }
  preambule: string[]
  axes: ParsedAxe[]
}

export interface HarmonizedItem {
  id: string
  type: 'axe' | 'bloc' | 'article'
  titre: string
  slug: string
  texte: string[]
  connexe: { tableau: string[][] | null; pistes: string[] } | null
  indexGlobal: number | null
  stats: Omit<Stats, 'status' | 'paragraphes'> | null
}

export type DataMap = Record<string, HarmonizedItem>

export interface Trame {
  meta: ParsedResult['meta']
  preambule: string[]
  axes: { id: string; blocs: { id: string; articles: string[] }[] }[]
}

export interface OdtParseOutput {
  result: ParsedResult
  data: DataMap
  trame: Trame
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

// ─── Parser principal ─────────────────────────────────────────────────────
export function parseOdtXml(xmlContent: string): ParsedResult {
  const doc = new DOMParser().parseFromString(xmlContent, 'text/xml')

  const officeNS = { office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0', ...NS }
  const selectFull = xpath.useNamespaces(officeNS)
  const body =
    (selectFull('//office:body/office:text', doc) as any[])[0] ||
    (selectFull('//office:text', doc) as any[])[0] ||
    (select('//*[local-name()="text"]', doc) as any[])[0]

  if (!body) throw new Error('Impossible de trouver le corps du document ODT')

  const nodes: any[] = []
  let sectionsRencontrees = 0
  let nodesDansSections = 0
  function flatten(parent: any, depthInSection: boolean) {
    const children = parent.childNodes
    for (let i = 0; i < children.length; i++) {
      const node = children[i]
      if (node.nodeType !== 1) continue
      if (node.localName === 'section') {
        sectionsRencontrees++
        flatten(node, true)
      } else {
        if (depthInSection) nodesDansSections++
        nodes.push(node)
      }
    }
  }
  flatten(body, false)

  const result: ParsedResult = {
    meta: {
      parsedAt: new Date().toISOString(),
      totalNodes: nodes.length,
      totalArticles: 0,
      totalBlocs: 0,
      totalAxes: 0,
      paragraphesPreambule: 0,
      sectionsRencontrees: 0,
      titresVides: 0,
    },
    preambule: [],
    axes: [],
  }

  let currentAxe: ParsedAxe | null = null
  let currentBloc: ParsedBloc | null = null
  let currentArticle: ParsedArticle | null = null
  const usedAxeSlugs = new Set<string>()
  let usedBlocSlugs = new Set<string>()
  let usedArticleSlugs = new Set<string>()
  let titresVides = 0
  let paragraphesPreambule = 0

  function finaliseArticle() {
    if (currentArticle && currentBloc) {
      const fullText = currentArticle.paragraphes.join('\n')
      currentArticle.stats = computeStats(fullText)
      currentBloc.articles.push(currentArticle)
      currentArticle = null
    }
  }

  function finaliseBloc() {
    finaliseArticle()
    if (currentBloc && currentAxe) {
      const allText = [currentBloc.intro.join('\n'), ...currentBloc.articles.map((a) => a.paragraphes.join('\n'))].join('\n')
      currentBloc.stats = computeStats(allText)
      currentAxe.blocs.push(currentBloc)
      currentBloc = null
    }
  }

  function finaliseAxe() {
    finaliseBloc()
    if (currentAxe) {
      const allText = [
        currentAxe.intro.join('\n'),
        ...currentAxe.blocs.map((b) => [b.intro.join('\n'), ...b.articles.map((a) => a.paragraphes.join('\n'))].join('\n')),
      ].join('\n')
      currentAxe.stats = computeStats(allText)
      result.axes.push(currentAxe)
      currentAxe = null
    }
  }

  for (const node of nodes) {
    const localName = node.localName

    if (localName === 'p' || localName === 'h') {
      const styleNameRaw = node.getAttribute('text:style-name') || ''

      if (META_STYLES.auteur.includes(styleNameRaw)) {
        const t = nodeText(node).trim()
        if (t && !result.meta.auteur) result.meta.auteur = t
        continue
      }
      if (META_STYLES.titreLivre.includes(styleNameRaw)) {
        const t = nodeText(node).trim()
        if (t && !result.meta.titreLivre) result.meta.titreLivre = t
        continue
      }

      const level = headingLevel(node)
      const text = nodeText(node).trim()

      if (level === 1) {
        finaliseAxe()
        if (!text) titresVides++
        const slug = makeUniqueSlug(text, usedAxeSlugs, `axe-${usedAxeSlugs.size + 1}`)
        usedBlocSlugs = new Set()
        currentAxe = { titre: text, slug, intro: [], blocs: [], stats: null }
        continue
      }

      if (level === 2) {
        finaliseBloc()
        if (!text) titresVides++
        const slug = makeUniqueSlug(text, usedBlocSlugs, `bloc-${usedBlocSlugs.size + 1}`)
        usedArticleSlugs = new Set()
        currentBloc = { titre: text, slug, intro: [], tableau: null, articles: [], stats: null }
        continue
      }

      if (level === 3) {
        finaliseArticle()
        if (!text) titresVides++
        const slug = makeUniqueSlug(text, usedArticleSlugs, `article-${usedArticleSlugs.size + 1}`)
        currentArticle = {
          titre: text,
          slug,
          numeroRomain: extractRomain(text),
          paragraphes: [],
          citations: [],
          pistes: [],
          tableauRenvois: null,
          stats: null,
        }
        continue
      }

      if (!text) continue

      if (currentArticle) {
        const styleName = styleNameRaw
        if (/citation|quote/i.test(styleName) || text.startsWith('«') || text.startsWith('"')) {
          currentArticle.citations.push(text)
        }
        if (/highlight|surlign/i.test(styleName)) {
          currentArticle.pistes.push(text)
        }
        currentArticle.paragraphes.push(text)
      } else if (currentBloc) {
        currentBloc.intro.push(text)
      } else if (currentAxe) {
        currentAxe.intro.push(text)
      } else {
        paragraphesPreambule++
        result.preambule.push(text)
      }
    }

    if (localName === 'table') {
      const tableData = extractTable(node)
      if (currentArticle) {
        ;(currentArticle as ParsedArticle).tableauRenvois = tableData
      } else if (currentBloc) {
        ;(currentBloc as ParsedBloc).tableau = tableData
      }
    }
  }

  finaliseAxe()

  let globalIndex = 1
  for (const axe of result.axes) {
    for (const bloc of axe.blocs) {
      for (const article of bloc.articles) {
        article.indexGlobal = globalIndex++
      }
    }
  }

  result.meta.totalArticles = globalIndex - 1
  result.meta.totalBlocs = result.axes.reduce((s, a) => s + a.blocs.length, 0)
  result.meta.totalAxes = result.axes.length
  result.meta.paragraphesPreambule = paragraphesPreambule
  result.meta.sectionsRencontrees = sectionsRencontrees
  result.meta.titresVides = titresVides

  return result
}

// ─── Harmonisation (port de harmonize.js) ─────────────────────────────────
function buildConnexe(tableau: string[][] | null, pistes?: string[]): HarmonizedItem['connexe'] {
  const hasTableau = !!tableau
  const hasPistes = Array.isArray(pistes) && pistes.length > 0
  if (!hasTableau && !hasPistes) return null
  return { tableau: tableau || null, pistes: pistes || [] }
}

function cleanStats(stats: Stats | null): HarmonizedItem['stats'] {
  if (!stats) return null
  const { status, paragraphes, ...rest } = stats
  return rest
}

export function harmonize(result: ParsedResult): { data: DataMap; trame: Trame } {
  const data: DataMap = {}
  const trame: Trame = { meta: result.meta, preambule: result.preambule, axes: [] }

  function addItem(
    type: HarmonizedItem['type'],
    source: { titre: string; slug: string; stats: Stats | null },
    fields: { texte?: string[]; tableau?: string[][] | null; pistes?: string[]; indexGlobal?: number | null },
  ): string {
    const id = randomUUID()
    data[id] = {
      id,
      type,
      titre: source.titre,
      slug: source.slug,
      texte: fields.texte || [],
      connexe: buildConnexe(fields.tableau ?? null, fields.pistes),
      indexGlobal: fields.indexGlobal != null ? fields.indexGlobal : null,
      stats: cleanStats(source.stats),
    }
    return id
  }

  for (const axe of result.axes) {
    const axeId = addItem('axe', axe, { texte: axe.intro })
    const trameAxe: Trame['axes'][number] = { id: axeId, blocs: [] }

    for (const bloc of axe.blocs) {
      const blocId = addItem('bloc', bloc, { texte: bloc.intro, tableau: bloc.tableau })
      const trameBloc = { id: blocId, articles: [] as string[] }

      for (const article of bloc.articles) {
        const articleId = addItem('article', article, {
          texte: article.paragraphes,
          tableau: article.tableauRenvois,
          pistes: article.pistes,
          indexGlobal: article.indexGlobal,
        })
        trameBloc.articles.push(articleId)
      }

      trameAxe.blocs.push(trameBloc)
    }

    trame.axes.push(trameAxe)
  }

  return { data, trame }
}

export async function parseOdtBuffer(buffer: Buffer): Promise<OdtParseOutput> {
  const xmlContent = await readOdtContentXml(buffer)
  const result = parseOdtXml(xmlContent)
  const { data, trame } = harmonize(result)
  return { result, data, trame }
}
