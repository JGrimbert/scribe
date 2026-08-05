import { describe, it, expect } from 'vitest'
import { computeImposition, toSpreads, pagesOfSpread } from './liminaire-imposition'

describe('computeImposition / toSpreads', () => {
  const pg = (opts = {}) => ({ isBlank: false, ...opts })

  it('numérote séquentiellement recto/verso sans contrainte', () => {
    const slots = computeImposition([pg(), pg(), pg()])
    expect(slots.map((s) => [s.number, s.parity, s.blank])).toEqual([
      [1, 'recto', false],
      [2, 'verso', false],
      [3, 'recto', false],
    ])
  })

  it('une blanche de tête devient couverture ; le contenu commence page 1 recto', () => {
    const slots = computeImposition([pg({ isBlank: true }), pg()])
    expect(slots.find((s) => s.cover)).toBeTruthy()
    const content = slots.find((s) => !s.blank)
    expect([content.number, content.parity]).toEqual([1, 'recto'])
  })

  it('precedes=blank insère UNE blanche explicite avant la page (belle page)', () => {
    // page 2 demande une belle page → blanche implicite en n°2, la page en n°3.
    const slots = computeImposition([pg(), pg({ precedes: 'blank' })])
    expect(slots.map((s) => [s.number, s.blank, s.implicit || false])).toEqual([
      [1, false, false],
      [2, true, true],
      [3, false, false],
    ])
  })

  it('precedes=break n’insère AUCUNE blanche (simple saut de page)', () => {
    const slots = computeImposition([pg(), pg({ precedes: 'break' })])
    expect(slots.filter((s) => s.blank).length).toBe(0)
    expect(slots.map((s) => s.number)).toEqual([1, 2])
  })

  it('une blanche EXPLICITE du .odt occupe son propre folio', () => {
    const slots = computeImposition([pg(), pg({ isBlank: true }), pg()])
    expect(slots.map((s) => [s.number, s.blank])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ])
  })

  it('precedes=blank sur la toute première page ne crée pas de blanche (couverture)', () => {
    const slots = computeImposition([pg({ precedes: 'blank' }), pg()])
    expect(slots.filter((s) => s.blank).length).toBe(0)
    expect(slots.map((s) => s.number)).toEqual([1, 2])
  })

  it('planches : recto seul en tête, puis paires verso|recto', () => {
    const sp = toSpreads(computeImposition([pg(), pg(), pg()]))
    expect(sp[0].left).toBeNull()
    expect(sp[0].right.number).toBe(1)
    expect(sp[1].left.number).toBe(2)
    expect(sp[1].right.number).toBe(3)
  })
})

describe('pagesOfSpread', () => {
  const page = (key) => ({ key })

  it('rend les deux pages réelles, verso puis recto', () => {
    const spread = { left: { page: page('a') }, right: { page: page('b') } }
    expect(pagesOfSpread(spread).map((p) => p.key)).toEqual(['a', 'b'])
  })

  it('écarte la couverture et les blanches implicites — elles ne se découpent pas', () => {
    const spread = { left: { cover: true, blank: true }, right: { blank: true, implicit: true } }
    expect(pagesOfSpread(spread)).toEqual([])
  })

  it('garde une blanche EXPLICITE, qui vient bien d’une entrée du .odt', () => {
    const spread = { left: { blank: true, page: page('vide') }, right: null }
    expect(pagesOfSpread(spread).map((p) => p.key)).toEqual(['vide'])
  })

  it('rend une liste vide sur le cran terminal (aucun vis-à-vis)', () => {
    expect(pagesOfSpread(undefined)).toEqual([])
  })
})
