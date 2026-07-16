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

// ─── Suggestion du début de la partie finale ──────────────────────────────
// Le seul signal retenu est le NOM du titre, et seulement dans le dernier tiers
// du livre (un chapitre nommé « Index » au milieu d'un manuscrit est un
// chapitre, pas un appareil de fin).
//
// Le symétrique de suggestStructureStartIndex — « le dernier titre figurant
// dans la table des matières clôt le corps » — a été essayé puis ABANDONNÉ : sur
// le manuscrit témoin il coupe à « Octogramme », un article de niveau 3, parce
// que les deux derniers titres ont été ajoutés après la dernière mise à jour de
// la ToC. Une ToC périmée est la norme sur un manuscrit vivant, et le prix de
// l'erreur n'est pas symétrique : au début, une borne trop basse laisse du
// liminaire dans le corps (visible, corrigeable) ; à la fin, elle ampute le
// livre de vrais chapitres (silencieux). Même conclusion que les déductions de
// niveau abandonnées, cf. backend/CLAUDE.md : la ToC reflète les erreurs, elle
// ne les révèle pas.
//
// `undefined` = aucune suggestion, et c'est un résultat à part entière : la
// plupart des manuscrits n'ont pas d'appareil de fin (le témoin n'en a pas).
// L'utilisateur pose la démarcation à la main si besoin.
const FINAL_TITLE_RE = /table des mati|sommaire|^index\b|glossaire|bibliograph|annexe/i

export function suggestStructureEndIndex(outline: OutlineEntry[]): number | undefined {
  const cutoff = Math.floor((outline.length * 2) / 3)
  return outline.find((entry, i) => i >= cutoff && FINAL_TITLE_RE.test(entry.text.trim()))?.index
}
