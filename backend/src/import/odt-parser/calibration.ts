import { FlatNode, OutlineEntry } from './types'

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
