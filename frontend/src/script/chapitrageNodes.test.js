import { describe, it, expect } from 'vitest'
import { depthKeyOf, nodesAtDepthKey, firstNodeAtDepthKey } from './chapitrageNodes'

// Arbre à trois profondeurs : deux parties, la première portant deux chapitres,
// le premier chapitre portant deux sous-sections.
const axes = [
  {
    id: 'p1',
    children: [
      { id: 'c1', children: [{ id: 's1', children: [] }, { id: 's2', children: [] }] },
      { id: 'c2', children: [] },
    ],
  },
  { id: 'p2', children: [] },
]

const data = {
  p1: { titre: 'Partie I' },
  c1: { titre: 'Chapitre 1' },
  s1: { titre: 'Section 1' },
  // s2 sans titre → repli
  c2: { titre: 'Chapitre 2' },
  p2: { titre: 'Partie II' },
}

describe('depthKeyOf', () => {
  it('plafonne la profondeur à 2', () => {
    expect(depthKeyOf(axes, 'p1')).toBe(0)
    expect(depthKeyOf(axes, 'c1')).toBe(1)
    expect(depthKeyOf(axes, 's1')).toBe(2)
    expect(depthKeyOf(axes, 's2')).toBe(2)
  })

  it('renvoie 0 pour un id absent (chemin vide)', () => {
    expect(depthKeyOf(axes, 'inconnu')).toBe(0)
    expect(depthKeyOf([], 'p1')).toBe(0)
  })
})

describe('nodesAtDepthKey', () => {
  it('énumère les nœuds d\'un niveau dans l\'ordre de lecture', () => {
    expect(nodesAtDepthKey(axes, data, 0)).toEqual([
      { nodeId: 'p1', titre: 'Partie I' },
      { nodeId: 'p2', titre: 'Partie II' },
    ])
    expect(nodesAtDepthKey(axes, data, 1).map((n) => n.nodeId)).toEqual(['c1', 'c2'])
  })

  it('ne descend pas sous un nœud retenu (depthKey 2 = 2 et au-delà)', () => {
    expect(nodesAtDepthKey(axes, data, 2).map((n) => n.nodeId)).toEqual(['s1', 's2'])
  })

  it('replie sur (sans titre) quand data manque', () => {
    expect(nodesAtDepthKey(axes, data, 2).find((n) => n.nodeId === 's2').titre).toBe('(sans titre)')
    expect(nodesAtDepthKey(axes, {}, 0)[0].titre).toBe('(sans titre)')
  })

  it('tolère axes/data nuls', () => {
    expect(nodesAtDepthKey(null, null, 0)).toEqual([])
  })
})

describe('firstNodeAtDepthKey', () => {
  it('renvoie le premier nœud du niveau, ou null', () => {
    expect(firstNodeAtDepthKey(axes, data, 0)).toBe('p1')
    expect(firstNodeAtDepthKey(axes, data, 1)).toBe('c1')
    expect(firstNodeAtDepthKey(axes, data, 2)).toBe('s1')
    expect(firstNodeAtDepthKey([], data, 0)).toBe(null)
  })
})
