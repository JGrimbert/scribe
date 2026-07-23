/**
 * Port de Marvarid/parser/parse.js + harmonize.js.
 * Logique volontairement proche (mêmes règles de détection de titres, mêmes
 * styles de métadonnées, même calcul de stats) — avec deux différences
 * assumées par rapport à l'original : lecture depuis un Buffer en mémoire
 * (upload multipart) plutôt qu'un fichier disque, et une hiérarchie de
 * titres à profondeur arbitraire (voir ParsedNode) plutôt que les 3 niveaux
 * figés axe/bloc/article — un ODT n'a pas cette notion nativement (juste des
 * text:outline-level 1..10), c'est Marvarid qui l'imposait artificiellement.
 *
 * Découpé par thème (voir les modules voisins) :
 *   types.ts        — interfaces et types partagés
 *   text-utils.ts   — slug, chiffres romains, stats (pur, sans DOM)
 *   xml.ts          — lecture ODT/DOM/xpath (extraction bas niveau)
 *   flatten.ts      — passe 1 : XML → liste plate de nœuds
 *   calibration.ts  — outline + suggestion du point de départ
 *   hierarchy.ts    — passe 2 : liste plate → hiérarchie
 *   harmonize.ts    — hiérarchie → { data, trame } + liens internes
 */
import { OdtParseOutput, ParsedResult, ImportCorrections, FlatNode, OutlineEntry } from './types'
import { readOdtContentXml } from './xml'
import { readOdtStylesXml } from './visual'
import { buildFlatNodes } from './flatten'
import { buildParsedResult } from './hierarchy'
import { buildOutline, suggestStructureEndIndex, suggestStructureStartIndex } from './calibration'
import { harmonize } from './harmonize'

export * from './types'
export { readOdtContentXml } from './xml'
export { buildVisualStyles, readOdtStylesXml, readPageFormat, toCm } from './visual'
export { buildOutline, suggestStructureEndIndex, suggestStructureStartIndex } from './calibration'
export { harmonize } from './harmonize'
export { ventilateInventory, zoneOfDepth } from './zones'

// Ce que la calibration a besoin de savoir avant toute écriture : les titres
// détectés, et les deux bornes suggérées. `suggestedStructureEndIndex` est
// optionnel — pas de suggestion est un résultat valable (cf. calibration.ts).
export interface PreviewParse {
  flatNodes: FlatNode[]
  outline: OutlineEntry[]
  suggestedStructureStartIndex: number
  suggestedStructureEndIndex?: number
}

// ─── Parser principal ─────────────────────────────────────────────────────
export function parseOdtXml(xmlContent: string, corrections?: ImportCorrections, stylesXml?: string): ParsedResult {
  const { flatNodes, meta, sectionsRencontrees, inventory, outlineFormat } = buildFlatNodes(xmlContent, stylesXml)
  return buildParsedResult(flatNodes, meta, sectionsRencontrees, corrections, inventory, outlineFormat).result
}

// ─── Aperçu (calibration) : parse sans construire la structure finale ─────
export function parseOdtXmlForPreview(xmlContent: string): PreviewParse {
  const { flatNodes, tocTexts } = buildFlatNodes(xmlContent)
  const outline = buildOutline(flatNodes)
  return {
    flatNodes,
    outline,
    suggestedStructureStartIndex: suggestStructureStartIndex(outline, tocTexts),
    suggestedStructureEndIndex: suggestStructureEndIndex(outline),
  }
}

export async function parseOdtBuffer(buffer: Buffer, corrections?: ImportCorrections): Promise<OdtParseOutput> {
  const xmlContent = await readOdtContentXml(buffer)
  // Le format de page et l'apparence des styles n'existent que là (cf.
  // visual.ts). Toléré absent : un .odt sans styles.xml reste parsable pour sa
  // structure, qui est l'essentiel.
  const stylesXml = await readOdtStylesXml(buffer).catch(() => undefined)
  const { flatNodes, meta, sectionsRencontrees, inventory, outlineFormat } = buildFlatNodes(xmlContent, stylesXml)
  const { result, bookmarks } = buildParsedResult(flatNodes, meta, sectionsRencontrees, corrections, inventory, outlineFormat)
  const { data, trame } = harmonize(result, bookmarks)
  return { result, data, trame }
}

export async function parseOdtBufferForPreview(buffer: Buffer): Promise<PreviewParse> {
  const xmlContent = await readOdtContentXml(buffer)
  return parseOdtXmlForPreview(xmlContent)
}
