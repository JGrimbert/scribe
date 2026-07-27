// Réglages typographiques GÉNÉRAUX décidés par l'utilisateur, appliqués par-dessus
// les styles du .odt. Persistés à part (colonne `styleDefaults`), séparés de
// `styleInventory` (un relevé d'import) : ce sont des DÉCISIONS, même nature que
// `liminaireConfig`. Structuré en objets nommés pour accueillir de nouvelles
// propriétés sans migration (colonne Json).

import { PageFormat } from '../import/odt-parser'

// ─── Dimensions de page ────────────────────────────────────────────────────
// Format choisi (select A4/A5/poche…). null = celui du .odt.
export interface PageSize {
  widthCm: number
  heightCm: number
}

// ─── Marges en miroir (recto/verso) ────────────────────────────────────────
// « Petit fond » = marge INTÉRIEURE (côté reliure/gouttière), « grand fond » =
// marge EXTÉRIEURE. Blanc de tête/pied = haut/bas. À l'export .odt : page-usage
// « mirrored ». null = marges du .odt (symétriques, non miroir).
export interface PageMargins {
  topCm: number
  bottomCm: number
  innerCm: number
  outerCm: number
}

// ─── Titres courants (en-tête / pied / folio) ──────────────────────────────
// Contenu d'une zone de titre courant, `folio` = numéro de page. Vocabulaire
// FERMÉ (aligné sur le frontend) — une étiquette libre casserait le rendu.
export const RUNNING_CONTENTS = ['titre', 'chapitre', 'folio', 'aucun'] as const
export type RunningContent = (typeof RUNNING_CONTENTS)[number]

// Justification (placement horizontal) d'une bande. « regard » = bord EXTÉRIEUR
// (gauche en verso, droite en recto → region-left/right à l'export).
export const JUSTIFICATIONS = ['centre', 'regard'] as const
export type Justification = (typeof JUSTIFICATIONS)[number]

// Une bande (en-tête OU pied) : activable seule, contenu par côté (le folio est
// un contenu comme un autre), hauteur optionnelle (style:header-footer-properties
// du .odt), justification. Chaque bande → style:header/header-left (recto/verso)
// à l'export.
export interface RunningBand {
  enabled: boolean
  recto: RunningContent
  verso: RunningContent
  heightCm: number | null
  justification: Justification
}

export interface RunningTitles {
  header: RunningBand
  footer: RunningBand
}

export interface StyleDefaults {
  hyphenation: { global: boolean }
  pageSize: PageSize | null
  pageMargins: PageMargins | null
  runningTitles: RunningTitles
}

// Défaut métier : titre du livre en verso (pages paires), nom du chapitre en
// recto (impaires) pour l'en-tête ; folio au pied, centré. Tout désactivé au
// départ (opt-in) — les contenus pré-choisis donnent le bon rendu dès l'activation.
export const DEFAULT_RUNNING_TITLES: RunningTitles = {
  header: { enabled: false, recto: 'chapitre', verso: 'titre', heightCm: null, justification: 'regard' },
  footer: { enabled: false, recto: 'folio', verso: 'folio', heightCm: null, justification: 'centre' },
}

export const DEFAULT_STYLE_DEFAULTS: StyleDefaults = {
  hyphenation: { global: false },
  pageSize: null,
  pageMargins: null,
  runningTitles: DEFAULT_RUNNING_TITLES,
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isPosCm(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

// Erreurs de validation d'un corps entrant. Vide = valide. Vérifié côté serveur :
// le client peut être en retard d'un déploiement, et le vocabulaire est fermé.
export function styleDefaultsErrors(body: unknown): string[] {
  const errors: string[] = []
  if (body == null) return errors // null/absent = « aucun réglage », légitime
  if (!isObject(body)) return ['styleDefaults doit être un objet']

  const h = body.hyphenation
  if (h != null) {
    if (!isObject(h)) errors.push('hyphenation doit être un objet')
    else if (h.global != null && typeof h.global !== 'boolean') errors.push('hyphenation.global doit être un booléen')
  }

  const ps = body.pageSize
  if (ps != null) {
    if (!isObject(ps)) errors.push('pageSize doit être un objet ou null')
    else {
      for (const key of ['widthCm', 'heightCm'] as const) {
        if (!isPosCm(ps[key])) errors.push(`pageSize.${key} doit être un nombre positif`)
      }
    }
  }

  const pm = body.pageMargins
  if (pm != null) {
    if (!isObject(pm)) errors.push('pageMargins doit être un objet ou null')
    else {
      // Une marge peut valoir 0 (pleine page) : on n'exige que « nombre fini ≥ 0 ».
      for (const key of ['topCm', 'bottomCm', 'innerCm', 'outerCm'] as const) {
        const v = pm[key]
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) errors.push(`pageMargins.${key} doit être un nombre ≥ 0`)
      }
    }
  }

  errors.push(...runningTitlesErrors(body.runningTitles))
  return errors
}

function runningTitlesErrors(rt: unknown): string[] {
  if (rt == null) return []
  if (!isObject(rt)) return ['runningTitles doit être un objet']
  const errors: string[] = []

  // Forme héritée plate (`{ enabled, verso, recto, folio }`) : acceptée, migrée à
  // la normalisation. On ne valide alors que ses champs plats.
  if ('verso' in rt || 'recto' in rt) {
    for (const side of ['verso', 'recto'] as const) {
      if (rt[side] != null && !RUNNING_CONTENTS.includes(rt[side] as RunningContent)) {
        errors.push(`runningTitles.${side} doit valoir ${RUNNING_CONTENTS.join(' | ')}`)
      }
    }
    if (rt.enabled != null && typeof rt.enabled !== 'boolean') errors.push('runningTitles.enabled doit être un booléen')
    if (rt.folio != null && typeof rt.folio !== 'boolean') errors.push('runningTitles.folio (forme héritée) doit être un booléen')
    return errors
  }

  for (const band of ['header', 'footer'] as const) {
    const b = rt[band]
    if (b == null) continue
    if (!isObject(b)) {
      errors.push(`runningTitles.${band} doit être un objet`)
      continue
    }
    if (b.enabled != null && typeof b.enabled !== 'boolean') errors.push(`runningTitles.${band}.enabled doit être un booléen`)
    for (const side of ['recto', 'verso'] as const) {
      if (b[side] != null && !RUNNING_CONTENTS.includes(b[side] as RunningContent)) {
        errors.push(`runningTitles.${band}.${side} doit valoir ${RUNNING_CONTENTS.join(' | ')}`)
      }
    }
    if (b.justification != null && !JUSTIFICATIONS.includes(b.justification as Justification)) {
      errors.push(`runningTitles.${band}.justification doit valoir ${JUSTIFICATIONS.join(' | ')}`)
    }
    if (b.heightCm != null && !isPosCm(b.heightCm)) errors.push(`runningTitles.${band}.heightCm doit être un nombre positif ou null`)
  }
  return errors
}

// Rend un objet propre et complet : toute clé absente retombe sur son défaut. On
// stocke toujours la forme entière (pas d'entrée « morte » à interpréter côté
// lecture). Suppose `styleDefaultsErrors` déjà passé.
export function normalizeStyleDefaults(raw: unknown): StyleDefaults {
  const global = isObject(raw) && isObject(raw.hyphenation) && raw.hyphenation.global === true
  return {
    hyphenation: { global },
    pageSize: normalizePageSize(isObject(raw) ? raw.pageSize : null),
    pageMargins: normalizePageMargins(isObject(raw) ? raw.pageMargins : null),
    runningTitles: normalizeRunningTitles(isObject(raw) ? raw.runningTitles : null),
  }
}

function normalizePageSize(raw: unknown): PageSize | null {
  if (!isObject(raw) || !isPosCm(raw.widthCm) || !isPosCm(raw.heightCm)) return null
  return { widthCm: raw.widthCm, heightCm: raw.heightCm }
}

function normalizePageMargins(raw: unknown): PageMargins | null {
  if (!isObject(raw)) return null
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
  const top = num(raw.topCm), bottom = num(raw.bottomCm), inner = num(raw.innerCm), outer = num(raw.outerCm)
  if (top == null || bottom == null || inner == null || outer == null) return null
  return { topCm: top, bottomCm: bottom, innerCm: inner, outerCm: outer }
}

function content(v: unknown, fallback: RunningContent): RunningContent {
  return RUNNING_CONTENTS.includes(v as RunningContent) ? (v as RunningContent) : fallback
}

function normalizeRunningTitles(raw: unknown): RunningTitles {
  const d = DEFAULT_RUNNING_TITLES
  if (!isObject(raw)) return cloneRunningTitles(d)

  // Migration de la forme héritée plate (`{ enabled, verso, recto, folio }`) vers
  // la structure header/footer : l'en-tête reprend le contenu, le folio (booléen)
  // devient le contenu du pied.
  if ('verso' in raw || 'recto' in raw) {
    const footerFolio = raw.folio === true
    return {
      header: { enabled: raw.enabled === true, recto: content(raw.recto, d.header.recto), verso: content(raw.verso, d.header.verso), heightCm: null, justification: d.header.justification },
      footer: { enabled: footerFolio, recto: footerFolio ? 'folio' : 'aucun', verso: footerFolio ? 'folio' : 'aucun', heightCm: null, justification: d.footer.justification },
    }
  }

  // Migration de la forme précédente à `folio` séparé (`{ header, footer, folio }`) :
  // un folio actif devient le contenu du pied, sa position la justification du pied.
  const legacyFolio = isObject(raw.folio) && raw.folio.enabled === true
  const footerRaw = legacyFolio
    ? { ...(isObject(raw.footer) ? raw.footer : {}), enabled: true, recto: 'folio', verso: 'folio', justification: (raw.folio as Record<string, unknown>).position }
    : raw.footer

  return {
    header: normalizeBand(raw.header, d.header),
    footer: normalizeBand(footerRaw, d.footer),
  }
}

function normalizeBand(raw: unknown, d: RunningBand): RunningBand {
  if (!isObject(raw)) return cloneBand(d)
  return {
    enabled: raw.enabled === true,
    recto: content(raw.recto, d.recto),
    verso: content(raw.verso, d.verso),
    heightCm: isPosCm(raw.heightCm) ? raw.heightCm : null,
    justification: JUSTIFICATIONS.includes(raw.justification as Justification) ? (raw.justification as Justification) : d.justification,
  }
}

function cloneBand(b: RunningBand): RunningBand {
  return { ...b }
}

function cloneRunningTitles(rt: RunningTitles): RunningTitles {
  return { header: cloneBand(rt.header), footer: cloneBand(rt.footer) }
}

// ─── Merge dimensions / marges pour le rendu ───────────────────────────────
// Marges de secours quand le .odt n'a pas livré de format : celles du défaut A5
// de paged.css (frontend). Dupliquées dans pageFormats.js côté frontend — les
// deux merges (getContent ici, aperçu config là-bas) doivent rendre pareil.
const FALLBACK_MARGINS = { marginTopCm: 2.2, marginBottomCm: 2.2, marginLeftCm: 2, marginRightCm: 2 }

// Le choix utilisateur écrase les DIMENSIONS ; les marges restent celles du .odt
// (les marges MIROIR passent par `pageMargins`, à part, cf. rendu Folio).
export function applyPageSize(page: PageFormat | null, pageSize: PageSize | null): PageFormat | null {
  if (!pageSize) return page
  return { ...(page ?? FALLBACK_MARGINS), widthCm: pageSize.widthCm, heightCm: pageSize.heightCm }
}
