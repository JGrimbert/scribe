import { DOMParser } from 'xmldom'
import * as xpath from 'xpath'
import { FlatNode, ListItemEntry, OutlineFormat, PageStart, StyleInventory, StyleVisual } from './types'
import {
  NS,
  select,
  nodeText,
  nodeTextWithLinks,
  headingLevel,
  buildPageStarts,
  buildListStyles,
  buildStyleTable,
  effectiveStyleName,
  styleBackground,
  extractListItems,
  extractTocTexts,
  extractTable,
  extractInnerStyles,
  readOutlineFormat,
} from './xml'
import { buildStyleInventory } from './inventory'
import { buildParagraphVisualResolver, buildCharacterVisualResolver, toCm } from './visual'

// Apparence de caractère DOMINANTE d'un paragraphe : la taille/police/couleur du
// style de caractère (<text:span>) qui couvre le PLUS de texte. LibreOffice y range
// la taille réelle des runs de la page de titre (auteur 18pt, titre 32pt) là où le
// style de PARAGRAPHE hérite d'une autre valeur (40pt). Ne rend que des props de
// police : elles priment le paragraphe ; alignement/marges restent au paragraphe.
function dominantSpanVisual(
  node: any,
  charVisual: (name: string) => StyleVisual | undefined,
): Pick<StyleVisual, 'fontSize' | 'fontFamily' | 'color'> | undefined {
  const spans = select('.//*[local-name()="span"]', node) as any[]
  if (!spans.length) return undefined
  const topKey = (m: Map<string, number>): string | undefined =>
    [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const sizeLen = new Map<string, number>()
  const famLen = new Map<string, number>()
  const colorLen = new Map<string, number>()
  for (const s of spans) {
    const v = charVisual(s.getAttribute('text:style-name') || '')
    if (!v) continue
    const len = (s.textContent || '').length || 1
    if (v.fontSize) sizeLen.set(v.fontSize, (sizeLen.get(v.fontSize) ?? 0) + len)
    if (v.fontFamily) famLen.set(v.fontFamily, (famLen.get(v.fontFamily) ?? 0) + len)
    if (v.color) colorLen.set(v.color, (colorLen.get(v.color) ?? 0) + len)
  }
  const out: Pick<StyleVisual, 'fontSize' | 'fontFamily' | 'color'> = {}
  const fs = topKey(sizeLen); if (fs) out.fontSize = fs
  const ff = topKey(famLen); if (ff) out.fontFamily = ff
  const co = topKey(colorLen); if (co) out.color = co
  return Object.keys(out).length ? out : undefined
}

const META_STYLES = {
  auteur: ['auteur', 'P301'],
  titreLivre: ['titre principal', 'P197'],
}

// ─── Passe 1 : lecture du XML → liste plate de nœuds classés ──────────────
// Ne fait aucune hypothèse sur la structure finale : se contente de classer
// chaque nœud (titre détecté / paragraphe / tableau) dans l'ordre du
// document. C'est la passe 2 (buildParsedResult) qui décide, à partir de
// cette liste, comment construire la hiérarchie — et peut être rejouée avec
// des corrections sans revenir au XML.
// `stylesXml` est optionnel : le parse structurel n'en a aucun besoin (il ne
// lit que du contenu). Il ne sert qu'à donner une APPARENCE aux styles de
// l'inventaire — absent, l'inventaire est simplement muet là-dessus, comme
// avant. C'est aussi ce qui laisse `parseOdtXml(xml)` utilisable tel quel dans
// les tests, sans ODT complet sous la main.
export function buildFlatNodes(xmlContent: string, stylesXml?: string): {
  flatNodes: FlatNode[]
  meta: { auteur?: string; titreLivre?: string }
  sectionsRencontrees: number
  tocTexts: string[]
  inventory: StyleInventory
  outlineFormat: OutlineFormat | null
} {
  const doc = new DOMParser().parseFromString(xmlContent, 'text/xml')
  const stylesDoc = stylesXml ? new DOMParser().parseFromString(stylesXml, 'text/xml') : null

  const officeNS = { office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0', ...NS }
  const selectFull = xpath.useNamespaces(officeNS)
  const body =
    (selectFull('//office:body/office:text', doc) as any[])[0] ||
    (selectFull('//office:text', doc) as any[])[0] ||
    (select('//*[local-name()="text"]', doc) as any[])[0]

  if (!body) throw new Error('Impossible de trouver le corps du document ODT')

  const pageStarts = buildPageStarts(doc, stylesDoc)
  const listStyles = buildListStyles(doc)
  const styleTable = buildStyleTable(doc)
  const tocTexts = extractTocTexts(doc)
  // Apparence complète PAR PARAGRAPHE (style auto → mise en forme directe incluse).
  // Absent sans styles.xml (tests structurels sans ODT complet) : le résolveur rend
  // alors `undefined`, les FlatNode n'ont pas de `visual`, rendu inchangé.
  const paragraphVisual = buildParagraphVisualResolver(doc, stylesDoc)
  // Apparence de CARACTÈRE (spans) : la taille/police réelle des runs, que le style
  // de paragraphe ne porte pas (cf. dominantSpanVisual).
  const charVisual = buildCharacterVisualResolver(doc, stylesDoc)
  // Visual EFFECTIF d'un paragraphe = paragraphe + caractère dominant par-dessus
  // (police/corps/couleur priment). `undefined` si rien n'est porté.
  const effectiveVisual = (node: any, rawStyle: string): StyleVisual | undefined => {
    const merged = { ...(paragraphVisual(rawStyle) ?? {}), ...(dominantSpanVisual(node, charVisual) ?? {}) }
    return Object.keys(merged).length ? merged : undefined
  }

  // Aération : une ligne VIDE du .odt (paragraphe ou titre sans texte, hors saut de
  // page) ne devient pas une entrée — sa hauteur est reversée en marge basse de
  // l'élément PRÉCÉDENT (« espace sous l'élément précédent »). Sans ça, toutes les
  // lignes d'aération de la page de titre disparaissaient. On ne TOUCHE JAMAIS au flux
  // de FlatNode (les index pilotent les bornes de calibration persistées) : on ne fait
  // que gonfler le `visual` du dernier contenu — invisible au corps (qui ne persiste
  // pas `visual`), effectif au liminaire/final.
  let lastContentNode: FlatNode | null = null
  const lineHeightCm = (node: any, rawStyle: string): number => {
    const v = effectiveVisual(node, rawStyle) ?? {}
    const fsCm = toCm(v.fontSize ?? null) ?? 0.423 // défaut ≈ 12pt
    const lh = v.lineHeight
    if (lh) {
      if (lh.trim().endsWith('%')) return fsCm * (parseFloat(lh) / 100 || 1)
      const abs = toCm(lh)
      if (abs) return abs
    }
    return fsCm
  }
  const addSpacerBelowPrev = (cm: number) => {
    if (!lastContentNode || cm <= 0) return
    if (!lastContentNode.visual) lastContentNode.visual = {}
    const cur = toCm(lastContentNode.visual.marginBottom ?? null) ?? 0
    lastContentNode.visual.marginBottom = `${(cur + cm).toFixed(3)}cm`
  }

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

  // Pages blanches (paragraphes vides à pageStart) en attente : elles ne
  // deviennent pas des nœuds, elles se rattachent au prochain nœud émis. Voir
  // FlatNode.blanksBefore.
  let pendingBlanks: PageStart[] = []
  const flushBlanks = (): { blanksBefore?: PageStart[] } => {
    if (!pendingBlanks.length) return {}
    const blanksBefore = pendingBlanks
    pendingBlanks = []
    return { blanksBefore }
  }

  for (const node of rawNodes) {
    const localName = node.localName

    if (localName === 'list') {
      const items: ListItemEntry[] = []
      extractListItems(node, 0, items, styleTable)
      if (items.length) {
        const styleName = node.getAttribute('text:style-name') || ''
        flatNodes.push({
          index: flatNodes.length,
          kind: 'list',
          level: 0,
          text: '',
          styleName,
          effectiveStyle: effectiveStyleName(styleName, styleTable),
          highlight: styleBackground(styleName, styleTable),
          pageStart: null,
          ...flushBlanks(),
          listItems: items,
          listOrdered: listStyles.get(styleName) ?? false,
          // Le style du <text:list> est un style de LISTE (« L5 ») ; celui qui
          // dit quelque chose est le style des paragraphes des items.
          innerStyles: extractInnerStyles(node, styleTable),
        })
        lastContentNode = flatNodes[flatNodes.length - 1]
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
      const pageStart = pageStarts.get(styleName) ?? null
      const effectiveStyle = effectiveStyleName(styleName, styleTable)
      const highlight = styleBackground(styleName, styleTable)
      const visual = effectiveVisual(node, styleName)

      if (level >= 1) {
        // Texte du titre gardé brut (pas de lien) : un lien partiel dans un
        // titre casserait le slug/l'affichage — cf. plan "liens internes".
        const text = nodeText(node).trim()
        const bookmarkNames = (select('.//text:bookmark-start', node) as any[])
          .map((b: any) => b.getAttribute('text:name'))
          .filter(Boolean)
        flatNodes.push({
          index: flatNodes.length,
          kind: 'heading',
          level,
          text,
          styleName,
          effectiveStyle,
          highlight,
          pageStart,
          ...flushBlanks(),
          ...(visual ? { visual } : {}),
          ...(bookmarkNames.length ? { bookmarkNames } : {}),
        })
        // Titre VIDE : reste poussé (l'index alimente les bornes) mais n'ancre pas
        // le contenu — sa hauteur va en aération sous l'élément précédent.
        if (text) lastContentNode = flatNodes[flatNodes.length - 1]
        else if (!pageStart) addSpacerBelowPrev(lineHeightCm(node, styleName))
      } else {
        const text = nodeTextWithLinks(node, styleTable).trim()
        if (text) {
          flatNodes.push({
            index: flatNodes.length,
            kind: 'paragraph',
            level: 0,
            text,
            styleName,
            effectiveStyle,
            highlight,
            pageStart,
            ...flushBlanks(),
            ...(visual ? { visual } : {}),
          })
          lastContentNode = flatNodes[flatNodes.length - 1]
        } else if (pageStart) {
          // Paragraphe VIDE porteur d'un saut : une page blanche (verso/recto).
          // Pas un nœud — un marqueur rattaché au prochain nœud émis.
          pendingBlanks.push(pageStart)
        } else {
          // Ligne d'aération : reversée en marge basse de l'élément précédent.
          addSpacerBelowPrev(lineHeightCm(node, styleName))
        }
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
        effectiveStyle: '',
        highlight: null,
        pageStart: null,
        ...flushBlanks(),
        tableData: extractTable(node, styleTable),
        innerStyles: extractInnerStyles(node, styleTable),
      })
    }
  }

  return {
    flatNodes,
    meta,
    sectionsRencontrees,
    tocTexts,
    inventory: buildStyleInventory(doc, styleTable, stylesDoc),
    outlineFormat: readOutlineFormat(stylesDoc),
  }
}
