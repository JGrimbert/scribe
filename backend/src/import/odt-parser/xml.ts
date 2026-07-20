import * as unzipper from 'unzipper'
import * as xpath from 'xpath'
import { ListItemEntry, PageStart } from './types'

export const NS = {
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
}
export const select = xpath.useNamespaces(NS)

// ─── Lire le content.xml depuis un .odt (ZIP) en mémoire ──────────────────
export async function readOdtContentXml(buffer: Buffer): Promise<string> {
  const directory = await unzipper.Open.buffer(buffer)
  const entry = directory.files.find((f) => f.path === 'content.xml')
  if (!entry) throw new Error('content.xml non trouvé dans le ODT')
  const content = await entry.buffer()
  return content.toString('utf-8')
}

// ─── Styles : résolution de l'héritage et surlignages ─────────────────────
//
// LibreOffice génère un style automatique (`P26`, `T130`…) dès qu'un
// paragraphe porte la moindre mise en forme directe, et ce style hérite du
// vrai style nommé via `style:parent-style-name`. Sur un manuscrit réel, ça
// donne 338 noms de styles bruts pour... 35 styles réels. Sans résoudre le
// parent, toute typologie des styles est illisible.
//
// Un seul saut de parent : les styles nommés (dans styles.xml, non lu ici)
// peuvent eux-mêmes hériter, mais c'est le nom du style nommé qu'on veut
// afficher, pas la racine de sa chaîne d'héritage.

export interface OdtStyle {
  parent: string | null
  family: string
  background: string | null // fo:background-color, hors blanc/transparent
}

export type StyleTable = Map<string, OdtStyle>

// Les noms de styles ODT encodent les caractères spéciaux en _XX_ hexa :
// « Titre_20_1 » = « Titre 1 », « Puces_20__3f_ » = « Puces ? ».
export function decodeOdtStyleName(name: string): string {
  return name.replace(/_([0-9a-fA-F]{2})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

// Le blanc n'est pas un surlignage : c'est le fond par défaut, posé
// explicitement par LibreOffice sur quantité de styles.
function readBackground(styleNode: any): string | null {
  const props = (select('*[local-name()="text-properties"]', styleNode) as any[])[0]
  const value = props?.getAttribute('fo:background-color')
  if (!value || value === 'transparent' || value.toLowerCase() === '#ffffff') return null
  return value.toLowerCase()
}

export function buildStyleTable(doc: any): StyleTable {
  const table: StyleTable = new Map()
  for (const styleNode of select('//*[local-name()="style"]', doc) as any[]) {
    const name = styleNode.getAttribute('style:name')
    if (!name) continue
    table.set(name, {
      parent: styleNode.getAttribute('style:parent-style-name') || null,
      family: styleNode.getAttribute('style:family') || '',
      background: readBackground(styleNode),
    })
  }
  return table
}

// Nom du style RÉEL derrière un style automatique, décodé et prêt à afficher.
// Un style sans parent est déjà un style nommé (ou un style purement
// décoratif, ex. un T-style qui ne porte qu'un surlignage) : on le rend tel
// quel.
export function effectiveStyleName(styleName: string, table: StyleTable): string {
  const style = table.get(styleName)
  return decodeOdtStyleName(style?.parent ?? styleName)
}

// Couleur de surlignage portée par un style, directement ou par son parent.
export function styleBackground(styleName: string, table: StyleTable): string | null {
  const style = table.get(styleName)
  if (!style) return null
  if (style.background) return style.background
  return (style.parent && table.get(style.parent)?.background) ?? null
}

// ─── Extraire le texte brut d'un nœud (récursif) ──────────────────────────
export function nodeText(node: any): string {
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

// Variante de nodeText qui préserve les liens hypertexte internes
// (<text:a xlink:href="#signet">) en les entourant d'un marqueur
// `<a data-bookmark="signet">…</a>` — résolu en id de nœud réel dans une
// passe finale (cf. harmonize()), une fois les ids assignés. Les liens
// externes (href ne commençant pas par '#') sont hors périmètre : le texte
// est conservé mais le lien n'est pas matérialisé, comme avant.
//
// Préserve aussi les SURLIGNAGES inline (<text:span> dont le style porte un
// fo:background-color) en `<mark data-hl="#ffff00">…</mark>`. Sur le manuscrit
// témoin, ces surlignages sont des annotations de travail (« passage à
// reprendre ») : les aplatir, c'était perdre la seule trace de ce qui reste à
// faire à l'intérieur d'un paragraphe. La couleur est conservée brute — c'est
// la typologie (configurable) qui lui donne un sens, pas le parseur.
export function nodeTextWithLinks(node: any, table?: StyleTable): string {
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
    if (child.localName === 'a') {
      const href = child.getAttribute('xlink:href') || ''
      const inner = nodeTextWithLinks(child, table)
      if (href.startsWith('#')) {
        text += `<a data-bookmark="${href.slice(1)}">${inner}</a>`
      } else {
        text += inner
      }
      continue
    }
    if (child.localName === 'span' && table) {
      const highlight = styleBackground(child.getAttribute('text:style-name') || '', table)
      const inner = nodeTextWithLinks(child, table)
      text += highlight ? `<mark data-hl="${highlight}">${inner}</mark>` : inner
      continue
    }
    text += nodeTextWithLinks(child, table)
  }
  return text
}

export function headingLevel(paraNode: any): number {
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

// Un fo:break-before directionnel impose un côté (page paire/impaire), pas un
// simple saut. Rare dans les .odt LibreOffice (qui passent par master-page,
// cf. plus bas) mais valide en XSL-FO — on le gère pour ne pas dépendre d'un
// seul encodage.
const BREAK_SIDE: Record<string, PageStart> = {
  right: 'recto', odd: 'recto', 'odd-page': 'recto',
  left: 'verso', even: 'verso', 'even-page': 'verso',
}

// Côté imposé par chaque master-page, via sa page-layout (style:page-usage) :
// right = recto (page impaire), left = verso (page paire). « mirrored »/« all »/
// absent n'imposent aucun côté. Vit dans styles.xml (master-styles + les
// page-layouts « Mpm* » des automatic-styles).
function buildMasterPageSides(stylesDoc: any): Map<string, PageStart> {
  const layoutUsage = new Map<string, string>()
  for (const layout of select('//*[local-name()="page-layout"]', stylesDoc) as any[]) {
    const name = layout.getAttribute('style:name')
    const usage = layout.getAttribute('style:page-usage')
    if (name && usage) layoutUsage.set(name, usage)
  }
  const sides = new Map<string, PageStart>()
  for (const master of select('//*[local-name()="master-page"]', stylesDoc) as any[]) {
    const name = master.getAttribute('style:name')
    const layout = master.getAttribute('style:page-layout-name')
    const usage = layout ? layoutUsage.get(layout) : undefined
    const side: PageStart | null = usage === 'right' ? 'recto' : usage === 'left' ? 'verso' : null
    if (name && side) sides.set(name, side)
  }
  return sides
}

interface RawBreak {
  parent: string | null
  // Présent (même chaîne vide) = le style change/impose la page — le null
  // signifie « attribut absent », distinct d'une valeur vide (« saut sans
  // changement de style » d'OpenOffice, qui doit arrêter la remontée).
  // Nom de la master-page. `null` = attribut absent. Chaîne VIDE = attribut
  // présent mais vide : ce n'est PAS un saut — c'est un défaut hérité que
  // LibreOffice pose sur des styles de base (« Paragraphes », utilisé par 846
  // paragraphes sur le témoin). Le traiter comme un saut faisait démarrer une
  // page à chaque paragraphe du corps. Seule une valeur NON VIDE force une page.
  masterPage: string | null
  breakBefore: string | null
}

// Signal de composition BRUT porté par un style (sans résolution d'héritage).
function collectRawBreaks(doc: any, into: Map<string, RawBreak>) {
  for (const styleNode of select('//*[local-name()="style"]', doc) as any[]) {
    const name = styleNode.getAttribute('style:name')
    if (!name) continue
    const props = (select('*[local-name()="paragraph-properties"]', styleNode) as any[])[0]
    into.set(name, {
      parent: styleNode.getAttribute('style:parent-style-name') || null,
      masterPage: styleNode.hasAttribute('style:master-page-name')
        ? styleNode.getAttribute('style:master-page-name')
        : null,
      breakBefore: props?.getAttribute('fo:break-before') || null,
    })
  }
}

// Composition de page effective PAR STYLE, résolue par héritage — couvre les
// styles automatiques (content.xml) ET nommés (styles.xml), car l'un hérite de
// l'autre (« P247 » → « Heading 1 ») et c'est sur le style nommé que vit la
// contrainte recto des axes. Ne retient que les styles à composition non nulle,
// comme l'ancien Set : un `styleName` absent de la Map = aucune contrainte.
//
// Précédence : une contrainte de CÔTÉ (recto/verso) prime un simple saut, où
// qu'elle soit dans la chaîne — un axe qui porte en plus un fo:break-before
// « page » reste recto. Un master-page-name NON VIDE fait autorité et arrête la
// remontée ; vide, il est transparent (cf. RawBreak.masterPage). Validé sur le
// témoin : axes/blocs → recto, « Page paire » → verso, vrais sauts → page (19,
// pas 220 — sans quoi les 846 paragraphes du corps démarraient chacun une page).
export function buildPageStarts(contentDoc: any, stylesDoc: any | null): Map<string, PageStart> {
  const masterSides = stylesDoc ? buildMasterPageSides(stylesDoc) : new Map<string, PageStart>()
  const raw = new Map<string, RawBreak>()
  if (stylesDoc) collectRawBreaks(stylesDoc, raw)
  collectRawBreaks(contentDoc, raw) // les automatiques l'emportent sur un homonyme nommé

  function resolve(name: string): PageStart | null {
    const seen = new Set<string>()
    let plainPage = false
    let cur: string | null = name
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      const st = raw.get(cur)
      if (!st) break
      // Seule une master-page NON VIDE fait autorité (recto/verso, ou saut nu si
      // non mappée). Vide = pas un signal → on continue la remontée.
      if (st.masterPage) return masterSides.get(st.masterPage) ?? 'page'
      const b = st.breakBefore
      if (b && BREAK_SIDE[b]) return BREAK_SIDE[b]
      if (b === 'page') plainPage = true // faible : on continue à grimper chercher un côté
      cur = st.parent
    }
    return plainPage ? 'page' : null
  }

  const result = new Map<string, PageStart>()
  for (const name of raw.keys()) {
    const start = resolve(name)
    if (start) result.set(name, start)
  }
  return result
}

// Styles de liste (text:list-style, dans automatic-styles ET styles — un
// style de liste réutilisé délibérément est souvent nommé et rangé dans
// office:styles plutôt qu'auto-généré). Ne retient que la distinction
// numéroté/à puces (premier niveau) : les nuances (romain, lettré, puce
// personnalisée) sont laissées à un rendu cosmétique côté frontend, pas
// portées par Quill de toute façon (cf. plan "Articles par nœud").
export function buildListStyles(doc: any): Map<string, boolean> {
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
export function extractListItems(listNode: any, depth: number, items: ListItemEntry[], table?: StyleTable) {
  const itemNodes = select('text:list-item', listNode) as any[]
  for (const itemNode of itemNodes) {
    const children = itemNode.childNodes
    const textParts: string[] = []
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType !== 1) continue
      if (child.localName === 'p' || child.localName === 'h') {
        const t = nodeTextWithLinks(child, table).trim()
        if (t) textParts.push(t)
      }
    }
    if (textParts.length) items.push({ text: textParts.join(' '), depth })

    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType === 1 && child.localName === 'list') {
        extractListItems(child, depth + 1, items, table)
      }
    }
  }
}

// Extrait le texte des lignes de la table des matières (si présente), pour
// aider à repérer où la vraie structure démarre : le liminaire (page de
// titre, auteur...) n'y figure normalement pas.
export function extractTocTexts(doc: any): string[] {
  const tocParagraphs = select('//*[local-name()="table-of-content"]//*[local-name()="index-body"]//*[local-name()="p"]', doc) as any[]
  return tocParagraphs
    .map((p) => nodeText(p).split('\t')[0].trim()) // coupe avant la tabulation + numéro de page
    .filter(Boolean)
}

// Styles effectifs de tous les paragraphes contenus dans un nœud qui les
// aplatit — cellules d'un tableau, items d'une liste. Relevé brut, répétitions
// comprises (c'est un compte d'usages, pas un ensemble).
//
// extractTable/extractListItems ne rendent que du texte : un style qui ne vit
// QUE là serait invisible de toute analyse assise sur les FlatNode. Deux cas
// réels sur le témoin : « Voir » (183 usages en cellule) et « Puces ? » (15 en
// item de liste).
export function extractInnerStyles(node: any, table: StyleTable): string[] {
  return (select('.//text:p', node) as any[])
    .map((p: any) => effectiveStyleName(p.getAttribute('text:style-name') || '', table))
    .filter(Boolean)
}

export function extractTable(tableNode: any, table?: StyleTable): string[][] {
  const rows = select('.//table:table-row', tableNode) as any[]
  return rows.map((row) => {
    const cells = select('table:table-cell', row) as any[]
    return cells.map((cell) => {
      const paras = select('text:p', cell) as any[]
      return paras.map((p) => nodeTextWithLinks(p, table)).join('\n').trim()
    })
  })
}
