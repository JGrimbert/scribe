// Formats de page proposés au select « Dimensions » de la config : séries A +
// formats d'édition courants (poche, roman, grand format). Valeurs en cm (unité
// du relevé .odt), libellés en mm (unité d'usage en PAO).

export const PAGE_FORMATS = [
  { key: 'A6', label: 'A6 — 105 × 148 mm', widthCm: 10.5, heightCm: 14.8 },
  { key: 'poche', label: 'Poche — 110 × 178 mm', widthCm: 11, heightCm: 17.8 },
  { key: 'roman', label: 'Roman — 140 × 205 mm', widthCm: 14, heightCm: 20.5 },
  { key: 'A5', label: 'A5 — 148 × 210 mm', widthCm: 14.8, heightCm: 21 },
  { key: 'grand-format', label: 'Grand format — 155 × 240 mm', widthCm: 15.5, heightCm: 24 },
  { key: 'A4', label: 'A4 — 210 × 297 mm', widthCm: 21, heightCm: 29.7 },
  { key: 'letter', label: 'Letter — 216 × 279 mm', widthCm: 21.59, heightCm: 27.94 },
]

// Reconnaît un format à ±0,3 cm près : le témoin est à 14,801 × 21,001 cm, pas
// pile A5. Purement indicatif.
export function matchFormat(widthCm, heightCm) {
  if (widthCm == null || heightCm == null) return null
  const near = (a, b) => Math.abs(a - b) <= 0.3
  return PAGE_FORMATS.find((f) => near(f.widthCm, widthCm) && near(f.heightCm, heightCm)) ?? null
}

// Marges de secours quand le .odt n'a pas livré de format : celles du défaut A5
// de paged.css. Dupliquées dans style-defaults.ts côté backend (applyPageSize) —
// les deux merges (aperçu config ici, getContent là-bas) doivent rendre pareil.
const FALLBACK_MARGINS = { marginTopCm: 2.2, marginBottomCm: 2.2, marginLeftCm: 2, marginRightCm: 2 }

// Page EFFECTIVE pour l'aperçu : le choix utilisateur (styleDefaults.pageSize,
// en cours d'édition) écrase les dimensions, les marges restent celles du .odt.
// L'éditeur, lui, reçoit la page déjà mergée par le backend (getContent).
export function effectivePage(page, pageSize) {
  if (!pageSize) return page
  return { ...(page ?? FALLBACK_MARGINS), widthCm: pageSize.widthCm, heightCm: pageSize.heightCm }
}

// ─── Marges (recto/verso, en miroir) ──────────────────────────────────────
//
// Fallback des marges quand le .odt n'a rien livré : le défaut A5 de paged.css.
const FALLBACK_MIRROR = { topCm: 2.2, bottomCm: 2.2, innerCm: 2, outerCm: 2 }

// Marges MIROIR dérivées du relevé .odt : haut/bas directs, petit fond (intérieur)
// ← marge gauche, grand fond (extérieur) ← marge droite. Point de départ éditable
// quand l'utilisateur active des marges personnalisées.
export function marginsFromOdt(page) {
  if (!page) return { ...FALLBACK_MIRROR }
  return { topCm: page.marginTopCm, bottomCm: page.marginBottomCm, innerCm: page.marginLeftCm, outerCm: page.marginRightCm }
}

// Marges EFFECTIVES : la surcharge utilisateur (`pageMargins`) si présente, sinon
// celles dérivées du .odt. Alimente le diagramme recto/verso et l'aperçu.
export function effectiveMargins(page, pageMargins) {
  return pageMargins ?? marginsFromOdt(page)
}

// ─── Titres courants relevés dans le .odt ─────────────────────────────────
//
// Une zone d'en-tête/pied du .odt (RunningZone { text, fields }) → contenu Scribe
// ('titre' | 'chapitre' | 'aucun'). Un champ `title`/`chapter` prime sur le texte
// libre (assimilé au titre du livre). Sert à « reprendre » un .odt qui portait
// déjà des titres courants.
function contentFromZone(zone) {
  if (!zone) return null
  if (zone.fields?.includes('title')) return 'titre'
  if (zone.fields?.includes('chapter')) return 'chapitre'
  if (zone.text) return 'titre'
  return 'aucun'
}

// Vrai si le .odt (PageFormat) déclare au moins une zone d'en-tête/pied.
export function hasRunningZones(page) {
  return !!(page && (page.header || page.headerLeft || page.footer || page.footerLeft))
}

// Contenu d'une zone du .odt, `page-number` prioritaire (le folio est un contenu).
function contentOf(zone) {
  if (!zone) return null
  if (zone.fields?.includes('page-number')) return 'folio'
  return contentFromZone(zone)
}

// Une bande (en-tête ou pied) reprise de ses zones recto/verso du .odt.
// `*-left` = verso (pages paires), zone sans suffixe = recto (impaires) ; sans
// variante gauche, la zone unique vaut pour les deux côtés. Justification non
// relevée (region-*), défaut « centré ».
function bandFromZones(rectoZone, versoZone) {
  if (!rectoZone && !versoZone) return { enabled: false, recto: 'aucun', verso: 'aucun', heightCm: null, justification: 'centre' }
  return {
    enabled: true,
    recto: contentOf(rectoZone ?? versoZone) ?? 'aucun',
    verso: contentOf(versoZone ?? rectoZone) ?? 'aucun',
    heightCm: rectoZone?.heightCm ?? versoZone?.heightCm ?? null,
    justification: 'centre',
  }
}

// Suggestion de config `runningTitles` reprise du relevé .odt, ou null si le .odt
// n'en déclare aucune. Le numéro de page (`page-number`) devient le contenu
// `folio` de la bande où il apparaît.
export function runningTitlesFromOdt(page) {
  if (!hasRunningZones(page)) return null
  return {
    header: bandFromZones(page.header, page.headerLeft),
    footer: bandFromZones(page.footer, page.footerLeft),
  }
}
