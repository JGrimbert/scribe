import { describe, it, expect } from 'vitest'
import { StyleInventory } from '../import/odt-parser'
import { isTypologySettled, suggestRole, suggestTypology, typologyErrors } from './typology'

// Les cas sont pris tels quels dans le manuscrit témoin : ce sont ces
// noms-là que la suggestion doit savoir lire.
describe('suggestRole', () => {
  it.each([
    ['Heading 3', 'titre'],
    ['mention sous titre', 'définition'],
    ['Citation paragraphe', 'citation'],
    ['Quotations', 'citation'],
    ['Definition', 'définition'],
    ['Voir', 'renvoi'],
    ['Tab bloc semantique', 'tableau'],
    ['Puces ?', 'liste'],
    ['Chapeau Chapitre', 'chapeau'],
    ['Premier paragraphe de thématique', 'chapeau'],
    ['Couyard', 'ornement'],
    ['Asterisme', 'ornement'],
    ['Horizontal Line', 'ornement'],
    ['mentions légales', 'liminaire'],
    ['Auteur', 'liminaire'],
    ['Dédicace', 'liminaire'],
    ['Contents 2', 'ignorer'],
    ['Index 1', 'ignorer'],
    // Le style des paragraphes DANS une cellule de tableau — pas le sommaire,
    // malgré le mot « Contents ».
    ['Table Contents', 'tableau'],
  ])('propose « %s » → %s', (style, role) => {
    expect(suggestRole(style)).toBe(role)
  })

  it('retombe sur « corps » pour un style qui ne dit rien', () => {
    expect(suggestRole('Paragraphes')).toBe('corps')
    expect(suggestRole('Text body')).toBe('corps')
    expect(suggestRole('P26')).toBe('corps')
  })
})

const inventory = (styles: string[], highlights: string[] = []): StyleInventory => ({
  styles: styles.map((name) => ({ name, count: 1, headings: 0, sample: '' })),
  highlights: highlights.map((color) => ({ color, paragraphs: 1, spans: 0, sample: '' })),
})

describe('suggestTypology', () => {
  it('pré-remplit chaque style et présume l’annotation pour les surlignages', () => {
    expect(suggestTypology(inventory(['Voir', 'Paragraphes'], ['#ffff00']))).toEqual({
      styles: { Voir: 'renvoi', Paragraphes: 'corps' },
      highlights: { '#ffff00': 'annotation' },
    })
  })
})

describe('isTypologySettled', () => {
  const inv = inventory(['Voir', 'Paragraphes'], ['#ffff00'])

  it('n’est pas arbitrée tant que rien n’a été enregistré', () => {
    expect(isTypologySettled(null, inv)).toBe(false)
  })

  it('est arbitrée quand tout l’inventaire est couvert', () => {
    const typology = { styles: { Voir: 'renvoi' as const, Paragraphes: 'corps' as const }, highlights: { '#ffff00': 'annotation' as const } }
    expect(isTypologySettled(typology, inv)).toBe(true)
  })

  it('redevient non arbitrée quand un style apparaît (réimport d’une nouvelle version)', () => {
    const typology = { styles: { Voir: 'renvoi' as const }, highlights: { '#ffff00': 'annotation' as const } }
    expect(isTypologySettled(typology, inv)).toBe(false)
  })

  it('redevient non arbitrée quand une couleur de surlignage apparaît', () => {
    const typology = { styles: { Voir: 'renvoi' as const, Paragraphes: 'corps' as const }, highlights: {} }
    expect(isTypologySettled(typology, inv)).toBe(false)
  })
})

describe('typologyErrors — styles déclarés', () => {
  const inv = inventory(['Paragraphes'])

  it('refuse un style hors inventaire non déclaré', () => {
    const errs = typologyErrors({ styles: { Inventé: 'corps' }, highlights: {} }, inv)
    expect(errs.some((e) => e.includes('Style inconnu'))).toBe(true)
  })

  it('accepte un style hors inventaire s’il est déclaré', () => {
    const body = {
      styles: { Paragraphes: 'corps' as const, Renvoi: 'renvoi' as const },
      highlights: {},
      declaredStyles: [{ name: 'Renvoi', role: 'renvoi' as const, zoneKey: 'depth-0' as const, afterName: 'Paragraphes' }],
    }
    expect(typologyErrors(body, inv)).toEqual([])
  })

  it('refuse un style déclaré au rôle ou à la zone invalides', () => {
    const body = {
      styles: {},
      highlights: {},
      declaredStyles: [{ name: 'X', role: 'nope' as any, zoneKey: 'ailleurs' as any, afterName: null }],
    }
    const errs = typologyErrors(body, inv)
    expect(errs.some((e) => e.includes('Rôle inconnu'))).toBe(true)
    expect(errs.some((e) => e.includes('Zone inconnue'))).toBe(true)
  })

  it('refuse un style déclaré en doublon de l’inventaire', () => {
    const body = {
      styles: {},
      highlights: {},
      declaredStyles: [{ name: 'Paragraphes', role: 'corps' as const, zoneKey: 'depth-0' as const, afterName: null }],
    }
    expect(typologyErrors(body, inv).some((e) => e.includes('doublon de l\'inventaire'))).toBe(true)
  })
})
