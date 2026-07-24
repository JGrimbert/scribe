// Surcharges d'apparence décidées par l'utilisateur, par-dessus les styles du
// .odt. Le .odt reste IMMUABLE (styleInventory.visuals) : ces surcharges vivent
// à part (colonne `styleOverrides`) et sont mergées au rendu — on peut toujours
// revenir à l'original, et une recalibration ne les écrase pas.
//
// Une surcharge est un `Partial<StyleVisual>` : seules les propriétés que
// l'utilisateur a touchées y figurent (le reste retombe sur la valeur .odt). La
// césure suit du coup la cascade attendue une fois mergée : surcharge[S].hyphenate
// > visualODT[S].hyphenate > défaut global (cf. style-defaults.ts, folioStyles).

import { StyleVisual } from '../import/odt-parser'

export type StyleOverride = Partial<StyleVisual>
export type StyleOverrides = Record<string, StyleOverride>

// Clés éditables = toutes celles de StyleVisual, typées. On valide large (pas
// seulement les propriétés du panneau actuel) pour qu'ajouter un champ côté UI
// ne demande pas de toucher le backend.
const STRING_KEYS = [
  'fontFamily', 'fontSize', 'color', 'align', 'marginTop', 'marginBottom', 'textIndent', 'lineHeight',
  'marginLeft', 'marginRight', 'fontVariant', 'letterSpacing',
] as const
const BOOL_KEYS = ['bold', 'italic', 'pageBreakBefore', 'hyphenate', 'keepWithNext'] as const
const NUMBER_KEYS = ['widows', 'orphans'] as const

const STRING_KEY_SET = new Set<string>(STRING_KEYS)
const BOOL_KEY_SET = new Set<string>(BOOL_KEYS)
const NUMBER_KEY_SET = new Set<string>(NUMBER_KEYS)

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Erreurs de validation d'un corps entrant. Vide = valide. Vérifié côté serveur :
// le client peut être en retard d'un déploiement, et le vocabulaire est fermé.
export function styleOverridesErrors(body: unknown): string[] {
  const errors: string[] = []
  if (body == null) return errors // null/absent = « aucune surcharge »
  if (!isObject(body)) return ['styleOverrides doit être un objet']

  for (const [styleName, override] of Object.entries(body)) {
    if (!isObject(override)) {
      errors.push(`Style « ${styleName} » : surcharge invalide`)
      continue
    }
    for (const [key, value] of Object.entries(override)) {
      if (STRING_KEY_SET.has(key)) {
        if (typeof value !== 'string') errors.push(`Style « ${styleName} » : ${key} doit être une chaîne`)
      } else if (BOOL_KEY_SET.has(key)) {
        if (typeof value !== 'boolean') errors.push(`Style « ${styleName} » : ${key} doit être un booléen`)
      } else if (NUMBER_KEY_SET.has(key)) {
        if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`Style « ${styleName} » : ${key} doit être un nombre`)
      } else {
        errors.push(`Style « ${styleName} » : propriété inconnue « ${key} »`)
      }
    }
  }
  return errors
}

// Rend des surcharges propres : ne garde que les clés connues, bien typées, et
// non vides. Une chaîne vide efface la surcharge (retour à la valeur .odt) — pas
// stockée. Un style sans aucune surcharge effective disparaît (pas d'entrée
// morte). Suppose `styleOverridesErrors` déjà passé.
export function normalizeStyleOverrides(raw: unknown): StyleOverrides {
  if (!isObject(raw)) return {}
  const out: StyleOverrides = {}
  for (const [styleName, override] of Object.entries(raw)) {
    if (!isObject(override)) continue
    const clean: Record<string, unknown> = {}
    for (const key of STRING_KEYS) {
      const v = override[key]
      if (typeof v === 'string' && v.trim() !== '') clean[key] = v
    }
    for (const key of BOOL_KEYS) {
      const v = override[key]
      if (typeof v === 'boolean') clean[key] = v
    }
    for (const key of NUMBER_KEYS) {
      const v = override[key]
      if (typeof v === 'number' && Number.isFinite(v)) clean[key] = v
    }
    if (Object.keys(clean).length) out[styleName] = clean as StyleOverride
  }
  return out
}

// Apparence EFFECTIVE = valeur .odt + surcharge Scribe, propriété par propriété
// (la surcharge l'emporte). C'est ce que la couche Folio rend. Union des styles
// des deux côtés : une surcharge peut porter sur un style dont le .odt n'a pas de
// visual (rare, mais légitime).
export function mergeVisuals(
  base: Record<string, StyleVisual>,
  overrides: StyleOverrides,
): Record<string, StyleVisual> {
  const out: Record<string, StyleVisual> = {}
  for (const name of new Set([...Object.keys(base), ...Object.keys(overrides)])) {
    out[name] = { ...base[name], ...overrides[name] }
  }
  return out
}
