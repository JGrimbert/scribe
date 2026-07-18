import { DOMParser } from 'xmldom'
import * as xpath from 'xpath'
import { FlatNode, ListItemEntry, StyleInventory } from './types'
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
} from './xml'
import { buildStyleInventory } from './inventory'

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
          listItems: items,
          listOrdered: listStyles.get(styleName) ?? false,
          // Le style du <text:list> est un style de LISTE (« L5 ») ; celui qui
          // dit quelque chose est le style des paragraphes des items.
          innerStyles: extractInnerStyles(node, styleTable),
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
      const pageStart = pageStarts.get(styleName) ?? null
      const effectiveStyle = effectiveStyleName(styleName, styleTable)
      const highlight = styleBackground(styleName, styleTable)

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
          ...(bookmarkNames.length ? { bookmarkNames } : {}),
        })
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
          })
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
  }
}
