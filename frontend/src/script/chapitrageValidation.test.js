import { describe, it, expect } from 'vitest'
import {
  adjacencyHolds,
  depthKeyOf,
  evaluateNode,
  levelConstraints,
  nodeStyleSet,
  tallyByDepth,
} from './chapitrageValidation'

const shape = (nodeId, depth, runs) => ({ nodeId, titre: nodeId, depth, isLeaf: true, runs, chars: 9999 })

describe('depthKeyOf', () => {
  it('plafonne à 2 — « 2 et au-delà », comme les règles', () => {
    expect([0, 1, 2, 5].map(depthKeyOf)).toEqual([0, 1, 2, 2])
  })
})

describe('levelConstraints', () => {
  it('sans style exigé, les critères sont ceux du modèle', () => {
    const c = levelConstraints(null, ['Heading 3', 'Paragraphes'])
    expect(c).toEqual({ requiredStyles: ['Heading 3', 'Paragraphes'], adjacency: [], fromModel: true })
  })

  it('un style exigé prend la main sur le modèle', () => {
    const c = levelConstraints({ requiresStyles: ['Citation'], requiresAdjacency: [] }, ['Paragraphes'])
    expect(c.requiredStyles).toEqual(['Citation'])
    expect(c.fromModel).toBe(false)
  })

  it('ne déduit JAMAIS de succession du modèle', () => {
    expect(levelConstraints(null, ['A', 'B']).adjacency).toEqual([])
  })
})

describe('nodeStyleSet', () => {
  it('ajoute le style du titre, absent des runs', () => {
    const set = nodeStyleSet(shape('n1', 2, [['Paragraphes', 3]]), 'Heading 3')
    expect([...set]).toEqual(['Heading 3', 'Paragraphes'])
  })

  it('ignore les paragraphes sans style', () => {
    expect([...nodeStyleSet(shape('n1', 2, [['', 2]]))]).toEqual([])
  })
})

describe('adjacencyHolds', () => {
  const runs = [['Titre', 1], ['Chapeau', 1], ['Paragraphes', 4]]

  it('vrai quand chaque a est suivi d\'un b', () => {
    expect(adjacencyHolds(runs, 'Titre', 'Chapeau')).toBe(true)
  })

  it('faux quand le suivant n\'est pas b', () => {
    expect(adjacencyHolds(runs, 'Titre', 'Paragraphes')).toBe(false)
  })

  it('vacuément vrai si a est absent', () => {
    expect(adjacencyHolds(runs, 'Citation', 'Paragraphes')).toBe(true)
  })

  it('faux si a termine le nœud (pas de suivant)', () => {
    expect(adjacencyHolds(runs, 'Paragraphes', 'Citation')).toBe(false)
  })

  it('faux si a se répète : a est alors suivi de a', () => {
    expect(adjacencyHolds([['Citation', 2], ['Paragraphes', 1]], 'Citation', 'Paragraphes')).toBe(false)
  })
})

describe('evaluateNode', () => {
  const constraints = { requiredStyles: ['Heading 3', 'Paragraphes'], adjacency: [['Chapeau', 'Paragraphes']] }

  it('validable quand tout est là', () => {
    const s = shape('n1', 2, [['Chapeau', 1], ['Paragraphes', 3]])
    expect(evaluateNode(s, constraints, 'Heading 3')).toEqual({ validable: true, missing: [], broken: [] })
  })

  it('liste les styles manquants', () => {
    const s = shape('n2', 2, [['Chapeau', 1], ['Paragraphes', 1]])
    const v = evaluateNode(s, constraints, null)
    expect(v.validable).toBe(false)
    expect(v.missing).toEqual(['Heading 3'])
  })

  it('liste les successions rompues', () => {
    const s = shape('n3', 2, [['Chapeau', 1], ['Citation', 1], ['Paragraphes', 1]])
    const v = evaluateNode(s, constraints, 'Heading 3')
    expect(v.validable).toBe(false)
    expect(v.broken).toEqual([['Chapeau', 'Paragraphes']])
  })

  it('sans contrainte, tout nœud est validable', () => {
    expect(evaluateNode(shape('n4', 2, []), undefined).validable).toBe(true)
  })
})

describe('tallyByDepth', () => {
  const shapes = [
    shape('a1', 0, [['Intro', 1]]),
    shape('c1', 2, [['Paragraphes', 2]]),
    shape('c2', 2, [['Citation', 1]]),
    shape('c3', 3, [['Paragraphes', 1]]), // profondeur 3 → même clé que 2
  ]
  const constraintsByDepth = { 2: { requiredStyles: ['Paragraphes'], adjacency: [] } }

  it('groupe par clé de niveau et compte validables/validés/périmés', () => {
    const tally = tallyByDepth(shapes, {
      constraintsByDepth,
      titleStyleOf: () => null,
      validations: { c1: 'validé', c2: 'périmé' },
    })
    expect(tally[0]).toEqual({ total: 1, validables: 1, valides: 0, perimes: 0 })
    expect(tally[2]).toEqual({ total: 3, validables: 2, valides: 1, perimes: 1 })
  })

  it('tient compte du style de titre pour juger', () => {
    const tally = tallyByDepth([shape('c9', 2, [['Paragraphes', 1]])], {
      constraintsByDepth: { 2: { requiredStyles: ['Heading 3'], adjacency: [] } },
      titleStyleOf: (id) => (id === 'c9' ? 'Heading 3' : null),
    })
    expect(tally[2].validables).toBe(1)
  })

  it('rend un objet vide sans forme', () => {
    expect(tallyByDepth([], {})).toEqual({})
  })
})
