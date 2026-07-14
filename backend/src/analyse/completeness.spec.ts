import { describe, it, expect } from 'vitest'
import { buildParsedResult } from '../import/odt-parser/hierarchy'
import { harmonize } from '../import/odt-parser/harmonize'
import { FlatNode } from '../import/odt-parser'
import { assessCompleteness, stubNodeIds } from './completeness'

function flat(nodes: Partial<FlatNode>[]): FlatNode[] {
  return nodes.map((n, index) => ({
    index,
    kind: 'paragraph',
    level: 0,
    text: '',
    styleName: '',
    hasPageBreak: false,
    ...n,
  })) as FlatNode[]
}

const H = (level: number, text: string): Partial<FlatNode> => ({ kind: 'heading', level, text })
const P = (text: string): Partial<FlatNode> => ({ kind: 'paragraph', text })
const words = (n: number) => Array(n).fill('mot').join(' ')

function build(nodes: Partial<FlatNode>[]) {
  const { result, bookmarks } = buildParsedResult(flat(nodes), {}, 0)
  return harmonize(result, bookmarks)
}

describe('completeness', () => {
  it('ne recense que les feuilles en attente (vide ou ébauche)', () => {
    const { trame, data } = build([
      H(1, 'Axe'),
      H(2, 'Chapitre rédigé'),
      P(words(200)),
      H(2, 'Chapitre en attente'),
      P('trois petits mots'),
      H(2, 'Chapitre vide'),
    ])

    const { anomalies, leafCount, threshold } = assessCompleteness(trame, data)
    expect(threshold).toBe(50)
    expect(leafCount).toBe(3) // les trois chapitres ; l'axe est un conteneur
    expect(anomalies.map((a) => a.titre)).toEqual(['Chapitre en attente', 'Chapitre vide'])
    expect(anomalies.map((a) => a.status)).toEqual(['ébauche', 'vide'])
  })

  it('n’étiquette pas un conteneur sans préambule comme anomalie', () => {
    const { trame, data } = build([H(1, 'Axe sans intro'), H(2, 'Chapitre'), P(words(200))])
    const { anomalies } = assessCompleteness(trame, data)
    expect(anomalies).toHaveLength(0)
  })

  it('exclut du corpus tout stub, feuille ou conteneur', () => {
    const { trame, data } = build([
      H(1, 'Axe'),
      H(2, 'Chapitre rédigé'),
      P(words(200)),
      H(2, 'Chapitre en attente'),
      P('trop court'),
    ])
    const attenteId = trame.axes[0].children[1].id
    const redigeId = trame.axes[0].children[0].id
    const stubs = stubNodeIds(trame, data)
    expect(stubs.has(attenteId)).toBe(true)
    expect(stubs.has(redigeId)).toBe(false)
  })
})
