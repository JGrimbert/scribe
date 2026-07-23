import { describe, expect, it } from 'vitest'
import { normalizeStyleDefaults, styleDefaultsErrors } from './style-defaults'

describe('styleDefaultsErrors', () => {
  it('accepte null/absent (aucun réglage)', () => {
    expect(styleDefaultsErrors(null)).toEqual([])
    expect(styleDefaultsErrors(undefined)).toEqual([])
    expect(styleDefaultsErrors({})).toEqual([])
  })

  it('accepte une césure globale booléenne', () => {
    expect(styleDefaultsErrors({ hyphenation: { global: true } })).toEqual([])
    expect(styleDefaultsErrors({ hyphenation: { global: false } })).toEqual([])
  })

  it('refuse un booléen mal typé ou une forme invalide', () => {
    expect(styleDefaultsErrors({ hyphenation: { global: 'oui' } })[0]).toContain('booléen')
    expect(styleDefaultsErrors({ hyphenation: 'auto' })[0]).toContain('objet')
    expect(styleDefaultsErrors([])[0]).toContain('objet')
  })
})

describe('normalizeStyleDefaults', () => {
  it('complète les clés absentes par leur défaut', () => {
    expect(normalizeStyleDefaults(null)).toEqual({ hyphenation: { global: false } })
    expect(normalizeStyleDefaults({})).toEqual({ hyphenation: { global: false } })
  })

  it('ne retient global=true que sur un vrai booléen true', () => {
    expect(normalizeStyleDefaults({ hyphenation: { global: true } })).toEqual({ hyphenation: { global: true } })
    // Toute autre valeur (chaîne, absente) retombe sur false : pas de « truthy » implicite.
    expect(normalizeStyleDefaults({ hyphenation: { global: 'true' } })).toEqual({ hyphenation: { global: false } })
  })
})
