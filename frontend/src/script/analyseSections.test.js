import { describe, it, expect } from 'vitest'
import { ANALYSE_SECTIONS, visibleSections, sectionByKey, analyseLayers } from './analyseSections'

describe('analyseSections', () => {
  it('garde l’ordre du dashboard, le Vocabulaire en tête', () => {
    expect(ANALYSE_SECTIONS[0].key).toBe('vocabulaire')
    expect(ANALYSE_SECTIONS.map((s) => s.key)).toEqual([
      'vocabulaire', 'lexical', 'themes', 'flux', 'semantique',
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

  it('analyseLayers groupe les sections par calque, libellé = 1re section', () => {
    const layers = analyseLayers((step) => step === 'lexical')
    expect(layers.map((l) => l.key)).toEqual(['vocabulaire', 'lexical', 'semantique'])
    expect(layers.map((l) => l.label)).toEqual([
      'Vocabulaire', 'Champ lexical', 'Proximité sémantique',
    ])
    // Le calque lexical empile champ lexical + thèmes + fil des thèmes ;
    // le calque sémantique empile proximité + stats par article + entités.
    expect(layers[1].sections.map((s) => s.key)).toEqual(['lexical', 'themes', 'flux'])
    expect(layers[2].sections.map((s) => s.key)).toEqual(['semantique', 'unites', 'entites'])
  })

  it('un calque n’empile que ses sections révélées', () => {
    const layers = analyseLayers(() => false)
    const semantique = layers.find((l) => l.key === 'semantique')
    // unites/entites (needs lexical) écartés : le calque ne garde que la proximité.
    expect(semantique.sections.map((s) => s.key)).toEqual(['semantique'])
  })
})
