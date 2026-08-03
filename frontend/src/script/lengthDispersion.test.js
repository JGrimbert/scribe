import { describe, expect, it } from 'vitest'
import { dispersionGroups, median, nodeLengths } from './lengthDispersion'

const axes = [
  {
    id: 'a1',
    titre: 'Partie I',
    children: [
      { id: 'a1c1', titre: 'Chapitre 1', children: [{ id: 'a1c1s1', titre: 'Section', children: [] }] },
      { id: 'a1c2', titre: 'Chapitre 2', children: [] },
    ],
  },
  { id: 'a2', titre: 'Partie II', children: [] },
]

const data = {
  a1: { stats: { caracteres: 30000 } },
  a1c1: { stats: { caracteres: 20000 } },
  a1c1s1: { stats: { caracteres: 5000 } },
  a1c2: { stats: { caracteres: 10000 } },
  // a2 sans stats : un axe encore vide compte, à zéro.
}

describe('nodeLengths', () => {
  it('parcourt l’arbre en portant la profondeur et la zone', () => {
    const points = nodeLengths(axes, data)
    expect(points.map((p) => [p.id, p.depth, p.zoneKey])).toEqual([
      ['a1', 0, 'depth-0'],
      ['a1c1', 1, 'depth-1'],
      ['a1c1s1', 2, 'depth-2+'],
      ['a1c2', 1, 'depth-1'],
      ['a2', 0, 'depth-0'],
    ])
  })

  it('rend 0 pour un nœud sans stats plutôt que de l’omettre', () => {
    expect(nodeLengths(axes, data).find((p) => p.id === 'a2').chars).toBe(0)
  })

  it('tolère une trame ou des données absentes', () => {
    expect(nodeLengths(null, null)).toEqual([])
    expect(nodeLengths(axes, null)).toHaveLength(5)
  })
})

describe('median', () => {
  it('prend la valeur centrale sur un compte impair', () => {
    expect(median([10, 1, 5])).toBe(5)
  })

  it('moyenne les deux valeurs centrales sur un compte pair', () => {
    expect(median([1, 5, 10, 20])).toBe(7.5)
  })

  it('rend 0 sur une liste vide', () => {
    expect(median([])).toBe(0)
  })
})

describe('dispersionGroups', () => {
  it('groupe par niveau, dans l’ordre des zones, et omet les niveaux absents', () => {
    const groups = dispersionGroups(axes, data)
    expect(groups.map((g) => g.key)).toEqual(['depth-0', 'depth-1', 'depth-2+'])
    expect(groups[0].points).toHaveLength(2)
  })

  it('porte médiane et bornes du niveau', () => {
    const [niveau1] = dispersionGroups(axes, data)
    expect(niveau1).toMatchObject({ median: 15000, min: 0, max: 30000 })
  })

  it('rend une liste vide sans trame', () => {
    expect(dispersionGroups(null, null)).toEqual([])
  })
})
