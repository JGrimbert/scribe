import { describe, it, expect } from 'vitest'
import { detectCommunities, betweenness } from './graphMetrics'

// Deux triangles denses (a-b-c, x-y-z) reliés par une seule arête faible
// (c-x) : cas d'école, deux communautés attendues.
const nodes = ['a', 'b', 'c', 'x', 'y', 'z'].map((lemma) => ({ lemma, count: 1 }))
const edge = (source, target, npmi) => ({ source, target, npmi, count: 1 })
const edges = [
  edge('a', 'b', 0.8),
  edge('b', 'c', 0.8),
  edge('a', 'c', 0.8),
  edge('x', 'y', 0.8),
  edge('y', 'z', 0.8),
  edge('x', 'z', 0.8),
  edge('c', 'x', 0.1),
]

describe('detectCommunities', () => {
  it('sépare deux grappes reliées par un pont faible', () => {
    const comm = detectCommunities(nodes, edges)
    expect(comm.a).toBe(comm.b)
    expect(comm.b).toBe(comm.c)
    expect(comm.x).toBe(comm.y)
    expect(comm.y).toBe(comm.z)
    expect(comm.a).not.toBe(comm.x)
  })

  it('compacte les ids et ordonne par taille décroissante', () => {
    // Clique {a,b,c,d} (dense, non ambiguë) plus grande que {x,y} → id 0.
    const ns = ['a', 'b', 'c', 'd', 'x', 'y'].map((lemma) => ({ lemma, count: 1 }))
    const es = [
      edge('a', 'b', 0.9), edge('a', 'c', 0.9), edge('a', 'd', 0.9),
      edge('b', 'c', 0.9), edge('b', 'd', 0.9), edge('c', 'd', 0.9),
      edge('x', 'y', 0.9),
      edge('d', 'x', 0.05),
    ]
    const comm = detectCommunities(ns, es)
    expect(comm.a).toBe(0)
    expect(new Set(Object.values(comm))).toEqual(new Set([0, 1]))
  })

  it('est déterministe', () => {
    expect(detectCommunities(nodes, edges)).toEqual(detectCommunities(nodes, edges))
  })

  it('gère un graphe sans arête (chacun sa communauté)', () => {
    const comm = detectCommunities(nodes, [])
    expect(new Set(Object.values(comm)).size).toBe(nodes.length)
  })
})

describe('betweenness', () => {
  it('donne le score max au nœud-pont d’un chemin', () => {
    // a - b - c : b est sur tous les plus courts chemins a↔c.
    const ns = ['a', 'b', 'c'].map((lemma) => ({ lemma, count: 1 }))
    const es = [edge('a', 'b', 0.5), edge('b', 'c', 0.5)]
    const bc = betweenness(ns, es)
    expect(bc.b).toBe(1)
    expect(bc.a).toBe(0)
    expect(bc.c).toBe(0)
  })

  it('normalise entre 0 et 1', () => {
    const bc = betweenness(nodes, edges)
    for (const v of Object.values(bc)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    // Le pont c-x porte le trafic inter-grappes → parmi les plus élevés.
    expect(bc.c).toBeGreaterThan(0)
    expect(bc.x).toBeGreaterThan(0)
  })
})
