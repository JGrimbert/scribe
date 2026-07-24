import { describe, expect, it } from 'vitest'
import { mergeVisuals, normalizeStyleOverrides, styleOverridesErrors } from './style-overrides'

describe('styleOverridesErrors', () => {
  it('accepte null/absent et un objet vide', () => {
    expect(styleOverridesErrors(null)).toEqual([])
    expect(styleOverridesErrors({})).toEqual([])
  })

  it('accepte des propriétés connues bien typées', () => {
    expect(styleOverridesErrors({ Corps: { fontSize: '12pt', bold: true, hyphenate: false } })).toEqual([])
    expect(styleOverridesErrors({ Titre: { widows: 3, orphans: 2, keepWithNext: true } })).toEqual([])
  })

  it('refuse un mauvais type ou une propriété inconnue', () => {
    expect(styleOverridesErrors({ Corps: { fontSize: 12 } })[0]).toContain('chaîne')
    expect(styleOverridesErrors({ Corps: { bold: 'oui' } })[0]).toContain('booléen')
    expect(styleOverridesErrors({ Corps: { widows: 'deux' } })[0]).toContain('nombre')
    expect(styleOverridesErrors({ Corps: { wobble: 'x' } })[0]).toContain('inconnue')
    expect(styleOverridesErrors({ Corps: 'gras' })[0]).toContain('invalide')
    expect(styleOverridesErrors([])[0]).toContain('objet')
  })
})

describe('normalizeStyleOverrides', () => {
  it('jette les clés inconnues, les mauvais types et les chaînes vides', () => {
    const out = normalizeStyleOverrides({
      Corps: { fontSize: '12pt', fontFamily: '  ', wobble: 'x', bold: true },
    })
    expect(out).toEqual({ Corps: { fontSize: '12pt', bold: true } })
  })

  it('supprime un style dont il ne reste aucune surcharge', () => {
    expect(normalizeStyleOverrides({ Corps: { fontFamily: '' }, Titre: {} })).toEqual({})
  })
})

describe('mergeVisuals', () => {
  it('la surcharge Scribe l’emporte, propriété par propriété', () => {
    const base = { Corps: { fontFamily: 'Georgia', fontSize: '11pt', align: 'justify' } }
    const overrides = { Corps: { fontSize: '12pt', hyphenate: true } }
    expect(mergeVisuals(base, overrides).Corps).toEqual({
      fontFamily: 'Georgia', // hérité du .odt
      fontSize: '12pt', // surchargé
      align: 'justify', // hérité
      hyphenate: true, // ajouté
    })
  })

  it('unit les styles des deux côtés', () => {
    const merged = mergeVisuals({ A: { bold: true } }, { B: { italic: true } })
    expect(merged.A).toEqual({ bold: true })
    expect(merged.B).toEqual({ italic: true })
  })
})
