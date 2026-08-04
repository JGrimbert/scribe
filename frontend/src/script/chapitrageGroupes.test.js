import { describe, it, expect } from 'vitest'
import { deviation, groupByDeviation } from './chapitrageGroupes'

const node = (nodeId, runs) => ({ nodeId, titre: nodeId, shape: { nodeId, runs } })
const MODEL = ['Heading 3', 'Definition', 'Paragraphes']
const titleStyleOf = () => 'Heading 3'

describe('deviation', () => {
  it('rend les manquants dans l’ordre du modèle et les extras triés', () => {
    const styles = new Set(['Heading 3', 'Zeta', 'Alpha'])
    expect(deviation(styles, MODEL)).toEqual({
      missing: ['Definition', 'Paragraphes'],
      extra: ['Alpha', 'Zeta'],
    })
  })

  it('modèle satisfait exactement : aucun écart', () => {
    expect(deviation(new Set(MODEL), MODEL)).toEqual({ missing: [], extra: [] })
  })

  it('un style répété ne compte qu’une fois (ensemble, pas séquence)', () => {
    const styles = new Set(['Heading 3', 'Paragraphes'])
    expect(deviation(styles, MODEL).missing).toEqual(['Definition'])
  })
})

describe('groupByDeviation', () => {
  it('réunit les nœuds au même écart, quel que soit l’ORDRE de leurs styles', () => {
    const groups = groupByDeviation(
      [
        node('a', [['Paragraphes', 2], ['Citation', 1]]),
        node('b', [['Citation', 1], ['Paragraphes', 5]]),
      ],
      MODEL,
      titleStyleOf,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].count).toBe(2)
    expect(groups[0].nodes.map((n) => n.nodeId)).toEqual(['a', 'b'])
    expect(groups[0].missing).toEqual(['Definition'])
    expect(groups[0].extra).toEqual(['Citation'])
    expect(groups[0].styles).toEqual(['Heading 3', 'Paragraphes', 'Citation'])
  })

  it('les styles suivent l’ORDRE D’APPARITION (titre en tête), pas celui du modèle', () => {
    // Même ensemble que ci-dessus, mais Citation avant Paragraphes dans le texte.
    const groups = groupByDeviation([node('b', [['Citation', 1], ['Paragraphes', 5]])], MODEL, titleStyleOf)
    expect(groups[0].styles).toEqual(['Heading 3', 'Citation', 'Paragraphes'])
  })

  it('sépare les écarts différents et met le groupe CONFORME en tête', () => {
    const groups = groupByDeviation(
      [
        node('titre-seul-1', []),
        node('conforme', [['Definition', 1], ['Paragraphes', 4]]),
        node('titre-seul-2', []),
        node('titre-seul-3', []),
      ],
      MODEL,
      titleStyleOf,
    )
    expect(groups.map((g) => [g.count, g.missing])).toEqual([
      [1, []],
      [3, ['Definition', 'Paragraphes']],
    ])
    // « N nœuds qui n'ont que leur titre » se lit sur `styles`.
    expect(groups[1].styles).toEqual(['Heading 3'])
  })

  it('classe les groupes non conformes par effectif décroissant', () => {
    const groups = groupByDeviation(
      [
        node('x', [['Alpha', 1]]),
        node('y', [['Beta', 1]]),
        node('z', [['Beta', 1]]),
      ],
      MODEL,
      titleStyleOf,
    )
    expect(groups.map((g) => [g.count, g.extra])).toEqual([
      [2, ['Beta']],
      [1, ['Alpha']],
    ])
  })

  it('sans style de titre relevé, le titre du modèle manque', () => {
    const groups = groupByDeviation([node('n', [['Paragraphes', 1]])], MODEL, () => null)
    expect(groups[0].missing).toEqual(['Heading 3', 'Definition'])
  })

  it('sans modèle, tout style porté est un extra', () => {
    const groups = groupByDeviation([node('n', [['Paragraphes', 1]])], [], () => null)
    expect(groups[0]).toMatchObject({ missing: [], extra: ['Paragraphes'], count: 1 })
  })

  it('aucun nœud : aucun groupe', () => {
    expect(groupByDeviation([], MODEL, titleStyleOf)).toEqual([])
  })
})
