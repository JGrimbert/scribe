import * as unzipper from 'unzipper'
import * as xpath from 'xpath'
import { ListItemEntry } from './types'

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
export function nodeTextWithLinks(node: any): string {
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
      const inner = nodeTextWithLinks(child)
      if (href.startsWith('#')) {
        text += `<a data-bookmark="${href.slice(1)}">${inner}</a>`
      } else {
        text += inner
      }
      continue
    }
    text += nodeTextWithLinks(child)
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

// Styles dont la propriété de paragraphe force un saut de page (fo:break-before,
// valeur "page"/"left"/"right"/"even"/"odd" — tout sauf absent/"auto"). Un
// titre dont le style porte cette surcharge démarre visuellement comme un
// axe, même si son niveau sémantique (outline-level) dit autre chose —
// signal utile pour repérer un titre probablement mal classé.
export function buildPageBreakStyles(doc: any): Set<string> {
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
export function extractListItems(listNode: any, depth: number, items: ListItemEntry[]) {
  const itemNodes = select('text:list-item', listNode) as any[]
  for (const itemNode of itemNodes) {
    const children = itemNode.childNodes
    const textParts: string[] = []
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType !== 1) continue
      if (child.localName === 'p' || child.localName === 'h') {
        const t = nodeTextWithLinks(child).trim()
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
export function extractTocTexts(doc: any): string[] {
  const tocParagraphs = select('//*[local-name()="table-of-content"]//*[local-name()="index-body"]//*[local-name()="p"]', doc) as any[]
  return tocParagraphs
    .map((p) => nodeText(p).split('\t')[0].trim()) // coupe avant la tabulation + numéro de page
    .filter(Boolean)
}

export function extractTable(tableNode: any): string[][] {
  const rows = select('.//table:table-row', tableNode) as any[]
  return rows.map((row) => {
    const cells = select('table:table-cell', row) as any[]
    return cells.map((cell) => {
      const paras = select('text:p', cell) as any[]
      return paras.map(nodeTextWithLinks).join('\n').trim()
    })
  })
}
