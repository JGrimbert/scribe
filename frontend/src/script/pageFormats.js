// Formats de page du select « Dimensions ». Valeurs en cm (unité du relevé .odt),
// libellés en mm (unité d'usage en PAO).

export const PAGE_FORMATS = [
  { key: 'A6', label: 'A6 — 105 × 148 mm', widthCm: 10.5, heightCm: 14.8 },
  { key: 'poche', label: 'Poche — 110 × 178 mm', widthCm: 11, heightCm: 17.8 },
  { key: 'roman', label: 'Roman — 140 × 205 mm', widthCm: 14, heightCm: 20.5 },
  { key: 'A5', label: 'A5 — 148 × 210 mm', widthCm: 14.8, heightCm: 21 },
  { key: 'grand-format', label: 'Grand format — 155 × 240 mm', widthCm: 15.5, heightCm: 24 },
  { key: 'A4', label: 'A4 — 210 × 297 mm', widthCm: 21, heightCm: 29.7 },
  { key: 'letter', label: 'Letter — 216 × 279 mm', widthCm: 21.59, heightCm: 27.94 },
]

// Reconnaît un format à ±0,3 cm près (le témoin est à 14,801 × 21,001, pas pile A5).
export function matchFormat(widthCm, heightCm) {
  if (widthCm == null || heightCm == null) return null
  const near = (a, b) => Math.abs(a - b) <= 0.3
  return PAGE_FORMATS.find((f) => near(f.widthCm, widthCm) && near(f.heightCm, heightCm)) ?? null
}

// Défaut A5 de paged.css. Dupliqué dans style-defaults.ts côté backend : les deux
// merges (aperçu ici, getContent là-bas) doivent rendre pareil.
const FALLBACK_MARGINS = { marginTopCm: 2.2, marginBottomCm: 2.2, marginLeftCm: 2, marginRightCm: 2 }

// Page effective de l'aperçu : le choix utilisateur écrase les dimensions, les marges
// restent celles du .odt (l'éditeur reçoit la page déjà mergée par le backend).
export function effectivePage(page, pageSize) {
  if (!pageSize) return page
  return { ...(page ?? FALLBACK_MARGINS), widthCm: pageSize.widthCm, heightCm: pageSize.heightCm }
}

// ─── Unité d'affichage (le modèle reste en cm) ─────────────────────────────
export const UNITS = [
  { key: 'mm', label: 'mm', perCm: 10, dec: 1 },
  { key: 'cm', label: 'cm', perCm: 1, dec: 2 },
  { key: 'in', label: 'in', perCm: 1 / 2.54, dec: 3 },
  { key: 'pt', label: 'pt', perCm: 72 / 2.54, dec: 1 },
]

const unitDef = (key) => UNITS.find((u) => u.key === key) ?? UNITS[1]

export function unitStep(key) {
  return key === 'mm' || key === 'pt' ? 1 : 0.1
}

export function toUnit(cm, key) {
  if (cm == null || cm === false) return ''
  const u = unitDef(key)
  const f = 10 ** u.dec
  return Math.round(cm * u.perCm * f) / f
}

export function fromUnit(raw, key) {
  const n = Number(String(raw).trim())
  return Number.isFinite(n) ? n / unitDef(key).perCm : null
}

// ─── Marges (recto/verso, en miroir) ──────────────────────────────────────
const FALLBACK_MIRROR = { topCm: 2.2, bottomCm: 2.2, innerCm: 2, outerCm: 2 }

// Marges miroir dérivées du .odt : petit fond (intérieur) ← marge gauche, grand fond
// (extérieur) ← marge droite.
export function marginsFromOdt(page) {
  if (!page) return { ...FALLBACK_MIRROR }
  return { topCm: page.marginTopCm, bottomCm: page.marginBottomCm, innerCm: page.marginLeftCm, outerCm: page.marginRightCm }
}

// Surcharge utilisateur (`pageMargins`) si présente, sinon les marges du .odt.
export function effectiveMargins(page, pageMargins) {
  return pageMargins ?? marginsFromOdt(page)
}

// ─── Titres courants relevés dans le .odt ─────────────────────────────────
// Un champ `title`/`chapter` prime sur le texte libre (assimilé au titre du livre).
function contentFromZone(zone) {
  if (!zone) return null
  if (zone.fields?.includes('title')) return 'titre'
  if (zone.fields?.includes('chapter')) return 'chapitre'
  if (zone.text) return 'titre'
  return 'aucun'
}

export function hasRunningZones(page) {
  return !!(page && (page.header || page.headerLeft || page.footer || page.footerLeft))
}

// `page-number` prioritaire (le folio est un contenu).
function contentOf(zone) {
  if (!zone) return null
  if (zone.fields?.includes('page-number')) return 'folio'
  return contentFromZone(zone)
}

// Une bande reprise de ses zones recto/verso. `*-left` = verso (pages paires) ; sans
// variante gauche, la zone unique vaut pour les deux côtés.
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

// Config `runningTitles` reprise du .odt, ou null s'il n'en déclare aucune.
export function runningTitlesFromOdt(page) {
  if (!hasRunningZones(page)) return null
  return {
    header: bandFromZones(page.header, page.headerLeft),
    footer: bandFromZones(page.footer, page.footerLeft),
  }
}
