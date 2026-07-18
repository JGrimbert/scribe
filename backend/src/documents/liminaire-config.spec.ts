import { describe, it, expect } from 'vitest'
import { liminaireConfigErrors, normalizeLiminaireConfig } from './liminaire-config'

describe('liminaireConfigErrors', () => {
  it('accepte null / objet vide', () => {
    expect(liminaireConfigErrors(null)).toEqual([])
    expect(liminaireConfigErrors({})).toEqual([])
  })

  it('accepte des types et côtés du vocabulaire', () => {
    expect(liminaireConfigErrors({ lp_x: { type: 'mentions-legales', side: 'verso' } })).toEqual([])
  })

  it('rejette un type hors vocabulaire', () => {
    const e = liminaireConfigErrors({ lp_x: { type: 'preambule' } })
    expect(e).toHaveLength(1)
    expect(e[0]).toContain('type inconnu')
  })

  it('rejette un côté inconnu et une entrée non-objet', () => {
    expect(liminaireConfigErrors({ lp_x: { side: 'gauche' } })[0]).toContain('côté inconnu')
    expect(liminaireConfigErrors({ lp_x: 'faux-titre' })[0]).toContain('invalide')
  })

  it('rejette un corps non-objet', () => {
    expect(liminaireConfigErrors([])).toEqual(['liminaireConfig doit être un objet'])
  })
})

describe('normalizeLiminaireConfig', () => {
  it('null → {}', () => {
    expect(normalizeLiminaireConfig(null)).toEqual({})
  })

  it('n’enregistre pas « auto » (défaut) ni les entrées vides', () => {
    expect(normalizeLiminaireConfig({
      lp_a: { type: 'faux-titre', side: 'auto' },
      lp_b: { side: 'auto' },
      lp_c: {},
    })).toEqual({ lp_a: { type: 'faux-titre' } })
  })

  it('garde type + côté explicite, jette les clés hors vocabulaire', () => {
    expect(normalizeLiminaireConfig({
      lp_a: { type: 'mentions-legales', side: 'verso', bogus: 1 },
      lp_b: { type: 'xxx' },
    })).toEqual({ lp_a: { type: 'mentions-legales', side: 'verso' } })
  })
})
