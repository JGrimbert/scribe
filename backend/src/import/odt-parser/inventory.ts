import { HighlightUsage, StyleInventory, StyleUsage } from './types'
import { effectiveStyleName, nodeText, nodeTextWithLinks, select, styleBackground, StyleTable } from './xml'

// Inventaire des styles et surlignages réellement employés — la matière
// première de l'écran de typologie.
//
// Se construit sur le XML, et NON sur les FlatNode, alors même que ceux-ci
// sont déjà résolus : les FlatNode sont la vue STRUCTURELLE du document (ils
// aplatissent les tableaux en données, écartent les paragraphes vides). Or un
// style ne s'y trouve que s'il a survécu à ce filtrage — sur le manuscrit
// témoin, le style « Voir » (183 usages, à l'intérieur des tableaux)
// disparaissait complètement de l'inventaire. Un inventaire doit être
// exhaustif : c'est tout son propos.
//
// Seuls les APPAREILS GÉNÉRÉS sont écartés : leurs styles (Contents 1/2,
// Index 1, Index Heading…) sont posés par LibreOffice, pas par l'auteur — les
// proposer à la configuration serait du bruit. La table des matières était le
// seul exclu ; l'index alphabétique l'a rejointe après coup, sur constat : le
// témoin en porte un (6 paragraphes, en fin de document), qui plaçait « Index
// 1 » et « Index Heading » dans la liste des styles à typologiser. Les deux
// conteneurs sont générés par le même mécanisme et méritent le même sort.
//
// Ils sont déjà absents des FlatNode (flatten.ts saute table-of-content, et ne
// sait pas descendre dans alphabetical-index) : les garder ici, c'était donc
// aussi des styles impossibles à ventiler par zone — comptés, jamais situés.

const SAMPLE_MAX = 120

// Les conteneurs d'appareil, dont le contenu est régénéré par le traitement de
// texte à chaque mise à jour des champs.
const GENERATED_ANCESTOR = 'ancestor::*[local-name()="table-of-content" or local-name()="alphabetical-index"]'

const PARAGRAPHS_XPATH = `//*[(local-name()="p" or local-name()="h") and not(${GENERATED_ANCESTOR})]`
const SPANS_XPATH = `//*[local-name()="span" and not(${GENERATED_ANCESTOR})]`

function sampleOf(text: string): string {
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.length > SAMPLE_MAX ? `${plain.slice(0, SAMPLE_MAX)}…` : plain
}

function collectStyles(doc: any, table: StyleTable): StyleUsage[] {
  const byName = new Map<string, StyleUsage>()
  for (const node of select(PARAGRAPHS_XPATH, doc) as any[]) {
    const name = effectiveStyleName(node.getAttribute('text:style-name') || '', table)
    if (!name) continue
    let usage = byName.get(name)
    if (!usage) {
      usage = { name, count: 0, headings: 0, sample: '' }
      byName.set(name, usage)
    }
    usage.count++
    if (node.localName === 'h') usage.headings++
    // Un paragraphe vide compte comme usage du style, mais ne fait pas un
    // extrait : on cherche le premier qui donne à voir quelque chose.
    if (!usage.sample) usage.sample = sampleOf(nodeText(node))
  }
  return [...byName.values()].sort((a, b) => b.count - a.count)
}

function collectHighlights(doc: any, table: StyleTable): HighlightUsage[] {
  const byColor = new Map<string, HighlightUsage>()
  const usageFor = (color: string) => {
    let usage = byColor.get(color)
    if (!usage) {
      usage = { color, paragraphs: 0, spans: 0, sample: '' }
      byColor.set(color, usage)
    }
    return usage
  }

  for (const node of select(PARAGRAPHS_XPATH, doc) as any[]) {
    const color = styleBackground(node.getAttribute('text:style-name') || '', table)
    if (!color) continue
    const usage = usageFor(color)
    usage.paragraphs++
    if (!usage.sample) usage.sample = sampleOf(nodeText(node))
  }

  for (const node of select(SPANS_XPATH, doc) as any[]) {
    const color = styleBackground(node.getAttribute('text:style-name') || '', table)
    if (!color) continue
    const usage = usageFor(color)
    usage.spans++
    if (!usage.sample) usage.sample = sampleOf(nodeText(node))
  }

  return [...byColor.values()].sort((a, b) => b.paragraphs + b.spans - (a.paragraphs + a.spans))
}

export function buildStyleInventory(doc: any, table: StyleTable): StyleInventory {
  return { styles: collectStyles(doc, table), highlights: collectHighlights(doc, table) }
}
