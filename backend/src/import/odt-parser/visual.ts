import * as unzipper from 'unzipper'
import { PageFormat, StyleVisual } from './types'
import { decodeOdtStyleName, select } from './xml'

// ─── Ce à quoi les styles RESSEMBLENT ─────────────────────────────────────
//
// `xml.ts` ne lit que `content.xml`, où un style nommé (« Titre 1 ») n'a qu'un
// NOM : ses propriétés vivent dans `styles.xml`, jamais ouvert jusqu'ici. D'où
// ce module, et son unique raison d'être : rendre un aperçu FIDÈLE du livre
// possible (cf. le carrousel de pages-échantillons, `frontend/CLAUDE.md`).
//
// Deux différences assumées avec `effectiveStyleName` (xml.ts), qui reste la
// source du NOM et ne bouge pas :
//
// - **La chaîne d'héritage est résolue en ENTIER**, pas en un saut. Sur le
//   témoin : « Heading 1 » → « Heading » → « Standard », chacun n'apportant
//   qu'une partie de la mise en forme (le centrage vient de Heading 1, les
//   marges de Heading, l'interligne de Standard). Un saut unique suffisait à
//   trouver le nom à afficher ; il ne donne pas une apparence.
// - **On résout les styles NOMMÉS, pas les styles automatiques.** L'inventaire
//   est indexé par style effectif (« Corps de texte »), et un `P26` qui ajoute
//   un italique par-dessus n'a pas d'entrée à lui. Sa surcharge est donc perdue
//   ici — comme elle l'est déjà en base (`Paragraph.styleName` porte le style
//   effectif). Cohérent, mais à savoir : l'aperçu montre le style, pas les
//   retouches locales.

export async function readOdtStylesXml(buffer: Buffer): Promise<string> {
  const directory = await unzipper.Open.buffer(buffer)
  const entry = directory.files.find((f) => f.path === 'styles.xml')
  if (!entry) throw new Error('styles.xml non trouvé dans le ODT')
  return (await entry.buffer()).toString('utf-8')
}

interface RawStyle {
  parent: string | null
  text: Record<string, string>
  para: Record<string, string>
}

function attrsOf(styleNode: any, localName: string): Record<string, string> {
  const props = (select(`*[local-name()="${localName}"]`, styleNode) as any[])[0]
  const out: Record<string, string> = {}
  if (!props) return out
  const attributes = props.attributes
  for (let i = 0; i < attributes.length; i++) {
    out[attributes[i].name] = attributes[i].value
  }
  return out
}

// Tous les styles de paragraphe, des deux documents. `styles.xml` porte les
// styles nommés et leurs ancêtres ; `content.xml` les automatiques, dont on n'a
// besoin ici que pour ne pas casser une chaîne qui les traverserait.
function collectRawStyles(docs: any[]): Map<string, RawStyle> {
  const raw = new Map<string, RawStyle>()
  for (const doc of docs) {
    if (!doc) continue
    for (const node of select('//*[local-name()="style"]', doc) as any[]) {
      const name = node.getAttribute('style:name')
      if (!name) continue
      const family = node.getAttribute('style:family')
      if (family && family !== 'paragraph') continue
      raw.set(name, {
        parent: node.getAttribute('style:parent-style-name') || null,
        text: attrsOf(node, 'text-properties'),
        para: attrsOf(node, 'paragraph-properties'),
      })
    }
  }
  return raw
}

// `style:font-name` ne nomme PAS une police : c'est une référence interne
// (« Georgia2 ») vers une déclaration `style:font-face`, qui porte la vraie
// famille CSS — souvent une pile entière (« Arial, Helvetica, sans-serif »).
// Sans cette résolution, l'aperçu demande `font-family: Georgia2` au
// navigateur, qui ne connaît pas, et rend tout dans sa police par défaut.
function buildFontFaces(docs: any[]): Map<string, string> {
  const faces = new Map<string, string>()
  for (const doc of docs) {
    if (!doc) continue
    for (const node of select('//*[local-name()="font-face"]', doc) as any[]) {
      const name = node.getAttribute('style:name')
      const family = node.getAttribute('svg:font-family')
      if (name && family) faces.set(name, family)
    }
  }
  return faces
}

// Ne déquote que si la valeur ENTIÈRE est un littéral (« 'Georgia' ») : une
// pile de polices (« 'Google Sans', Roboto, Arial ») garde ses quotes internes,
// qui y sont syntaxiquement nécessaires.
function unquote(value: string): string {
  const single = /^'([^']*)'$/.exec(value.trim())
  return single ? single[1] : value
}

// N'émet QUE les clés réellement portées : une clé présente mais `undefined`
// écraserait la valeur héritée du parent lors de la fusion.
function toVisual(style: RawStyle, fontFaces: Map<string, string>): StyleVisual {
  const v: StyleVisual = {}
  const { text, para } = style

  const fontName = text['style:font-name']
  const family = fontName ? (fontFaces.get(fontName) ?? fontName) : text['fo:font-family']
  if (family) v.fontFamily = unquote(family)
  if (text['fo:font-size']) v.fontSize = text['fo:font-size']
  if (text['fo:font-weight']) v.bold = text['fo:font-weight'] === 'bold'
  if (text['fo:font-style']) v.italic = text['fo:font-style'] === 'italic'
  if (text['fo:color']) v.color = text['fo:color']
  // Césure : text-property ODF. N'émis que si porté (comme le reste) → la fusion
  // d'héritage le propage, et son absence signale « non défini » à la cascade Folio.
  if (text['fo:hyphenate']) v.hyphenate = text['fo:hyphenate'] === 'true'

  if (para['fo:text-align']) v.align = para['fo:text-align']
  if (para['fo:margin-top']) v.marginTop = para['fo:margin-top']
  if (para['fo:margin-bottom']) v.marginBottom = para['fo:margin-bottom']
  if (para['fo:text-indent']) v.textIndent = para['fo:text-indent']
  if (para['fo:line-height']) v.lineHeight = para['fo:line-height']
  if (para['fo:break-before']) v.pageBreakBefore = para['fo:break-before'] !== 'auto'

  return v
}

// Fusion racine → feuille : l'enfant l'emporte, propriété par propriété. Le
// `seen` casse les cycles — un .odt malformé peut faire hériter A de B et B de
// A, et une pile qui déborde ne dirait pas pourquoi.
function resolve(
  name: string,
  raw: Map<string, RawStyle>,
  fontFaces: Map<string, string>,
  cache: Map<string, StyleVisual>,
  seen: Set<string>,
): StyleVisual {
  const cached = cache.get(name)
  if (cached) return cached

  const style = raw.get(name)
  if (!style || seen.has(name)) return {}

  seen.add(name)
  const inherited = style.parent ? resolve(style.parent, raw, fontFaces, cache, seen) : {}
  seen.delete(name)

  const merged = { ...inherited, ...toVisual(style, fontFaces) }
  cache.set(name, merged)
  return merged
}

// Indexé par nom EFFECTIF décodé (« Heading_20_1 » → « Heading 1 ») : la même
// clé que `StyleUsage.name`, pour que le frontend n'ait rien à réconcilier.
export function buildVisualStyles(contentDoc: any, stylesDoc: any): Record<string, StyleVisual> {
  const raw = collectRawStyles([stylesDoc, contentDoc])
  const fontFaces = buildFontFaces([stylesDoc, contentDoc])
  const cache = new Map<string, StyleVisual>()
  const out: Record<string, StyleVisual> = {}

  for (const name of raw.keys()) {
    const visual = resolve(name, raw, fontFaces, cache, new Set())
    if (!Object.keys(visual).length) continue
    out[decodeOdtStyleName(name)] = visual
  }
  return out
}

// ─── Format de page ───────────────────────────────────────────────────────
//
// Sans lui, les vignettes sont au mauvais ratio, et ça se voit du premier coup
// d'œil : le témoin est en A5 (14,801 × 21,001 cm) là où la couche Folio rend
// de l'A4 par défaut.
//
// On lit le master-page « Standard », et lui seul : un ODT en porte 15 sur le
// témoin (Première page, Enveloppe, Paysage, Entrée de chapitre…), mais c'est
// « Standard » qui régit le corps du livre. Prendre le premier page-layout venu
// donnerait l'enveloppe.

const UNIT_TO_CM: Record<string, number> = { cm: 1, mm: 0.1, in: 2.54, pt: 2.54 / 72, pc: 2.54 / 6 }

export function toCm(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^(-?[\d.]+)(cm|mm|in|pt|pc)$/.exec(value.trim())
  if (!match) return null
  const factor = UNIT_TO_CM[match[2]]
  return factor ? parseFloat(match[1]) * factor : null
}

export function readPageFormat(stylesDoc: any): PageFormat | undefined {
  if (!stylesDoc) return undefined

  // `@*[local-name()="name"]` et non `@style:name` : le `select` de xml.ts ne
  // déclare que text/table/fo — un préfixe inconnu fait lever xpath, pas rendre
  // vide.
  const master = (select('//*[local-name()="master-page"][@*[local-name()="name"]="Standard"]', stylesDoc) as any[])[0]
  const layoutName = master?.getAttribute('style:page-layout-name')
  if (!layoutName) return undefined

  const layout = (
    select(`//*[local-name()="page-layout"][@*[local-name()="name"]="${layoutName}"]`, stylesDoc) as any[]
  )[0]
  const props = layout && (select('*[local-name()="page-layout-properties"]', layout) as any[])[0]
  if (!props) return undefined

  const widthCm = toCm(props.getAttribute('fo:page-width'))
  const heightCm = toCm(props.getAttribute('fo:page-height'))
  // Sans dimensions il n'y a pas de format : rendre des marges seules
  // laisserait le frontend inventer une page.
  if (!widthCm || !heightCm) return undefined

  return {
    widthCm,
    heightCm,
    marginTopCm: toCm(props.getAttribute('fo:margin-top')) ?? 0,
    marginBottomCm: toCm(props.getAttribute('fo:margin-bottom')) ?? 0,
    marginLeftCm: toCm(props.getAttribute('fo:margin-left')) ?? 0,
    marginRightCm: toCm(props.getAttribute('fo:margin-right')) ?? 0,
  }
}
