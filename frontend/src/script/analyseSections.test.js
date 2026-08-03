import { describe, it, expect } from 'vitest'
import { ANALYSE_SECTIONS, visibleSections, sectionByKey } from './analyseSections'

describe('analyseSections', () => {
  it('garde l’ordre du dashboard, le Vocabulaire en tête', () => {
    expect(ANALYSE_SECTIONS[0].key).toBe('vocabulaire')
    expect(ANALYSE_SECTIONS.map((s) => s.key)).toEqual([
      'vocabulaire', 'lexical', 'themes', 'flux', 'anomalies', 'longueurs', 'semantique',
      'unites', 'entites',
    ])
  })

  it('les clés sont uniques (elles keyent crans et vues)', () => {
    expect(new Set(ANALYSE_SECTIONS.map((s) => s.key)).size).toBe(ANALYSE_SECTIONS.length)
  })

  it('écarte les sections dont l’analyse n’est pas révélée', () => {
    const keys = visibleSections(() => false).map((s) => s.key)
    expect(keys).not.toContain('unites')
    expect(keys).not.toContain('entites')
    expect(keys).toContain('vocabulaire')
  })

  it('les rend toutes une fois l’étape révélée', () => {
    expect(visibleSections((step) => step === 'lexical')).toHaveLength(ANALYSE_SECTIONS.length)
  })

  it('sectionByKey retrouve une section, null sinon', () => {
    expect(sectionByKey('themes').label).toBe('Thèmes')
    expect(sectionByKey('inconnue')).toBeNull()
  })
})
