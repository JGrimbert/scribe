import { describe, it, expect } from 'vitest'
import { computeImposition, toSpreads, effectiveSide, pagesOfSpread } from './liminaire-imposition'

describe('computeImposition / toSpreads', () => {
  const pg = (side = 'auto', sideFromOdt = 'auto', isBlank = false) => ({ side, sideFromOdt, isBlank })

  it('numérote séquentiellement recto/verso sans contrainte', () => {
    const slots = computeImposition([pg(), pg(), pg()])
    expect(slots.map((s) => [s.number, s.parity, s.blank])).toEqual([
      [1, 'recto', false],
      [2, 'verso', false],
      [3, 'recto', false],
    ])
  })

  it('insère une blanche implicite pour tenir une contrainte recto', () => {
    // page 2 veut recto mais tomberait en verso (n°2) → blanche implicite, page en n°3.
    const slots = computeImposition([pg('auto'), pg('recto')])
    expect(slots.map((s) => [s.number, s.blank, s.implicit || false])).toEqual([
      [1, false, false],
      [2, true, true],
      [3, false, false],
    ])
  })

  it('une blanche de tête devient couverture ; le contenu commence page 1 recto', () => {
    const slots = computeImposition([pg('auto', 'verso', true), pg('auto')])
    expect(slots.find((s) => s.cover)).toBeTruthy()
    const content = slots.find((s) => !s.blank)
    expect([content.number, content.parity]).toEqual([1, 'recto'])
  })

  it('ABSORBE une blanche mal placée plutôt que d’en doubler une', () => {
    // contenu(n1 recto), blanche(n2), page voulant verso : n3 serait recto. La
    // blanche qui précède est mal placée → absorbée, la page reprend n2 = verso.
    // « La convention l’emporte sur les blanches du .odt. »
    const slots = computeImposition([pg(), pg('auto', 'auto', true), pg('verso')])
    expect(slots.filter((s) => s.blank).length).toBe(0)
    const last = slots[slots.length - 1]
    expect([last.number, last.parity]).toEqual([2, 'verso'])
  })

  it('la convention du type (typeSide) sert d’ancre quand aucun côté n’est choisi', () => {
    // page 2 est taguée page-de-titre (typeSide recto) mais tomberait en verso →
    // blanche implicite, la page de titre repasse recto.
    const slots = computeImposition([pg(), { side: 'auto', sideFromOdt: 'auto', isBlank: false, typeSide: 'recto' }])
    expect(slots.map((s) => [s.number, s.blank, s.implicit || false])).toEqual([
      [1, false, false],
      [2, true, true],
      [3, false, false],
    ])
  })

  it('le côté choisi et le .odt priment sur la convention du type', () => {
    // typeSide recto, mais côté CHOISI verso → verso l’emporte (pas de blanche).
    expect(effectiveSide({ side: 'verso', typeSide: 'recto' })).toBe('verso')
    // typeSide recto, .odt réel verso → le .odt l’emporte.
    expect(effectiveSide({ side: 'auto', sideFromOdt: 'verso', typeSide: 'recto' })).toBe('verso')
    // rien de choisi ni .odt → la convention du type parle.
    expect(effectiveSide({ side: 'auto', sideFromOdt: 'auto', typeSide: 'recto' })).toBe('recto')
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
