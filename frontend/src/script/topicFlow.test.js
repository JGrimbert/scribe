import { describe, expect, it } from 'vitest'
import { maxCount, readingIndex, readingNodes, topicFlow } from './topicFlow'

const axes = [
  { id: 'a', titre: 'A', children: [{ id: 'a1', titre: 'A1', children: [] }] },
  { id: 'b', titre: 'B', children: [] },
]

const topics = {
  topics: [
    { topicId: 0, label: 'mer' },
    { topicId: 1, label: 'ville' },
    { topicId: 2, label: 'vide' },
  ],
  projection: [
    { nodeId: 'a', topicId: 0 },
    { nodeId: 'a', topicId: 0 },
    { nodeId: 'b', topicId: 0 },
    { nodeId: 'a1', topicId: 1 },
    { nodeId: 'a', topicId: -1 }, // hors thème
    { nodeId: 'disparu', topicId: 1 }, // nœud absent de la trame
  ],
}

describe('readingNodes / readingIndex', () => {
  it('numérote les nœuds dans l’ordre de lecture (préfixe), titre compris', () => {
    expect(readingNodes(axes)).toEqual([
      { id: 'a', titre: 'A' }, { id: 'a1', titre: 'A1' }, { id: 'b', titre: 'B' },
    ])
    expect([...readingIndex(axes).entries()]).toEqual([['a', 0], ['a1', 1], ['b', 2]])
  })

  it('rend une liste vide sans trame', () => {
    expect(readingNodes(null)).toEqual([])
    expect(readingIndex(null).size).toBe(0)
  })
})

describe('topicFlow', () => {
  it('additionne les segments d’un même thème dans un même chapitre', () => {
    const { rows } = topicFlow(topics, axes)
    expect(rows[0]).toMatchObject({ topicId: 0, points: [{ rank: 0, count: 2 }, { rank: 2, count: 1 }] })
  })

  it('écarte le hors-thème, les nœuds absents et les thèmes sans point', () => {
    const { rows } = topicFlow(topics, axes)
    expect(rows.map((r) => r.topicId)).toEqual([0, 1])
    expect(rows[1].points).toEqual([{ rank: 1, count: 1 }])
  })

  it('borne le nombre de thèmes (la palette n’en distingue pas plus)', () => {
    expect(topicFlow(topics, axes, { maxTopics: 1 }).rows).toHaveLength(1)
  })

  it('rend l’étendue de l’axe (les nœuds, dans l’ordre de lecture)', () => {
    expect(topicFlow(topics, axes).nodes.map((n) => n.id)).toEqual(['a', 'a1', 'b'])
  })

  it('ne casse pas sans thèmes ni trame', () => {
    expect(topicFlow(null, axes).rows).toEqual([])
    expect(topicFlow(topics, null).rows).toEqual([])
  })
})

describe('maxCount', () => {
  it('rend le plus gros paquet, 0 sur une liste vide', () => {
    expect(maxCount(topicFlow(topics, axes).rows)).toBe(2)
    expect(maxCount([])).toBe(0)
  })
})
