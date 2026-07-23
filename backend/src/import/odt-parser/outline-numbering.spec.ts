import { describe, it, expect } from 'vitest'
import { formatOutlineNumber, computeOutlineNumbers } from './outline-numbering'
import { FlatNode, OutlineFormat } from './types'

describe('formatOutlineNumber', () => {
  it('formate arabe / romain / alpha, sinon null', () => {
    expect(formatOutlineNumber(17, '1')).toBe('17')
    expect(formatOutlineNumber(17, 'I')).toBe('XVII')
    expect(formatOutlineNumber(4, 'i')).toBe('iv')
    expect(formatOutlineNumber(1, 'a')).toBe('a')
    expect(formatOutlineNumber(27, 'a')).toBe('aa')
    expect(formatOutlineNumber(2, 'A')).toBe('B')
    expect(formatOutlineNumber(3, '')).toBeNull() // niveau non numéroté
    expect(formatOutlineNumber(0, 'I')).toBeNull() // compteur nul
  })
})

// FlatNode minimal : seuls kind/level/index comptent pour la numérotation.
const H = (index: number, level: number): FlatNode => ({
  index,
  kind: 'heading',
  level,
  text: `T${index}`,
  styleName: '',
  effectiveStyle: '',
  highlight: null,
  pageStart: null,
})
const P = (index: number): FlatNode => ({ ...H(index, 0), kind: 'paragraph' })

// Format témoin : niv.1 « (a) », niv.2 « 1. », niv.3 « I. ».
const FORMAT: OutlineFormat = {
  1: { numFormat: 'a', prefix: '(', suffix: ')', displayLevels: 1 },
  2: { numFormat: '1', prefix: '', suffix: '.', displayLevels: 1 },
  3: { numFormat: 'I', prefix: '', suffix: '.', displayLevels: 1 },
}

describe('computeOutlineNumbers', () => {
  it('numérote par niveau et remet à zéro les niveaux inférieurs', () => {
    const nodes = [
      H(0, 1), //  (a)
      H(1, 2), //  1.
      H(2, 3), //  I.   ← premier article
      H(3, 3), //  II.
      H(4, 2), //  2.   ← nouveau bloc : les articles repartent à I.
      H(5, 3), //  I.
    ]
    const n = computeOutlineNumbers(nodes, FORMAT)
    expect(n.get(0)).toBe('(a)')
    expect(n.get(1)).toBe('1.')
    expect(n.get(2)).toBe('I.')
    expect(n.get(3)).toBe('II.')
    expect(n.get(4)).toBe('2.')
    expect(n.get(5)).toBe('I.')
  })

  it('ignore les paragraphes et atteint XVII sur 17 articles consécutifs', () => {
    const nodes: FlatNode[] = [H(0, 2)]
    for (let i = 1; i <= 17; i++) {
      nodes.push(H(nodes.length, 3))
      nodes.push(P(nodes.length)) // du corps entre les titres, sans effet
    }
    const n = computeOutlineNumbers(nodes, FORMAT)
    // Le 17e titre de niveau 3.
    const last = nodes.filter((x) => x.kind === 'heading' && x.level === 3).at(-1)!
    expect(n.get(last.index)).toBe('XVII.')
  })

  it('rend une map vide sans format', () => {
    expect(computeOutlineNumbers([H(0, 3)], null).size).toBe(0)
  })
})
