import { describe, it, expect } from 'vitest'
import { buildTree, partitionOutline } from './calibration'

// Raccourci : une entrée d'outline (index, texte, niveau relevé du document).
const E = (index, text, level = 0) => ({ index, text, level })

describe('buildTree', () => {
  it('imbrique les niveaux supérieurs sous le dernier ancêtre ouvert', () => {
    const roots = buildTree([
      { text: 'a', effectiveLevel: 0 },
      { text: 'b', effectiveLevel: 1 },
      { text: 'c', effectiveLevel: 1 },
      { text: 'd', effectiveLevel: 0 },
    ])
    expect(roots.map((n) => n.entry.text)).toEqual(['a', 'd'])
    expect(roots[0].children.map((n) => n.entry.text)).toEqual(['b', 'c'])
    expect(roots[1].children).toEqual([])
  })

  it('un saut de niveau s’imbrique sans nœud fantôme', () => {
    // 0 puis 2 directement : le niveau 2 se pose sous le 0, pas sous un 1 inventé.
    const roots = buildTree([
      { text: 'a', effectiveLevel: 0 },
      { text: 'b', effectiveLevel: 2 },
    ])
    expect(roots.map((n) => n.entry.text)).toEqual(['a'])
    expect(roots[0].children.map((n) => n.entry.text)).toEqual(['b'])
  })
})

describe('partitionOutline', () => {
  const outline = [E(0, 'Faux-titre'), E(1, 'Chap. 1'), E(2, 'Section 1.1', 1), E(3, 'Index')]

  it('sépare liminaire / corps / partie finale', () => {
    const items = partitionOutline(outline, { startIndex: 1, endIndex: 3, levelOverrides: {} })
    expect(items.map((i) => i.type)).toEqual(['liminaire', 'node', 'final'])
    // Le corps est un arbre : la section 1.1 est enfant du chapitre.
    const body = items.find((i) => i.type === 'node')
    expect(body.node.entry.text).toBe('Chap. 1')
    expect(body.node.children.map((n) => n.entry.text)).toEqual(['Section 1.1'])
  })

  it('sans partie finale, tout ce qui suit le début est du corps', () => {
    const items = partitionOutline(outline, { startIndex: 0, endIndex: null, levelOverrides: {} })
    expect(items.every((i) => i.type === 'node')).toBe(true)
    // startIndex 0 : aucun liminaire. Trois racines (Faux-titre, Chap. 1 qui
    // porte Section 1.1, Index), la section restant enfant du chapitre.
    expect(items).toHaveLength(3)
  })

  it('levelOverrides prime sur le niveau du document', () => {
    // La section 1.1 forcée au niveau 0 devient une racine, plus un enfant.
    const items = partitionOutline(outline, { startIndex: 1, endIndex: 3, levelOverrides: { 2: 0 } })
    const nodes = items.filter((i) => i.type === 'node')
    expect(nodes.map((n) => n.node.entry.text)).toEqual(['Chap. 1', 'Section 1.1'])
    expect(nodes[0].node.children).toEqual([])
  })
})
