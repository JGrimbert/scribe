import { describe, it, expect } from 'vitest'
import { spreadStyleNames, spreadStyles } from './liminaire-styles'

const page = (...styleNames) => ({
  page: { entries: styleNames.map((styleName) => (styleName ? { styleName } : { isBlank: true })) },
})

describe('spreadStyleNames', () => {
  it('prend les styles des deux pages, gauche puis droite, sans doublon', () => {
    const spread = { left: page('Titre', 'corps'), right: page('corps', 'mentions') }
    expect(spreadStyleNames(spread)).toEqual(['Titre', 'corps', 'mentions'])
  })

  it('ignore les pages blanches et de garde (elles n’ont rien à styler)', () => {
    expect(spreadStyleNames({ left: { blank: true }, right: { cover: true } })).toEqual([])
  })

  it('ignore les entrées blanches (respirations du .odt)', () => {
    expect(spreadStyleNames({ left: page('corps', null, 'corps') })).toEqual(['corps'])
  })

  it('tolère une planche absente ou à moitié vide', () => {
    expect(spreadStyleNames(null)).toEqual([])
    expect(spreadStyleNames({ left: page('corps') })).toEqual(['corps'])
  })
})

describe('spreadStyles', () => {
  it('rend l’item d’inventaire quand il existe, le nom seul sinon', () => {
    const inventory = [{ name: 'corps', sample: 'Il était…', declared: false }]
    const out = spreadStyles({ left: page('corps', 'orphelin') }, inventory)
    expect(out[0]).toBe(inventory[0])
    expect(out[1]).toEqual({ name: 'orphelin' })
  })
})
