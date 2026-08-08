import { describe, it, expect } from 'vitest'
import { annotationColors, annotatedPassages, nodeCharCounts } from './annotations'

const NODES = [
  { id: 'a', titre: 'Chapitre I', path: '' },
  { id: 'b', titre: 'Chapitre II', path: 'Partie 1' },
]

const HIGHLIGHTS = { '#ffff00': 'annotation', '#00ff00': 'emphase' }

describe('annotationColors', () => {
  it('ne retient que les couleurs typées annotation, repliées en minuscules', () => {
    expect(annotationColors({ '#FFFF00': 'annotation', '#00ff00': 'emphase' }))
      .toEqual(new Set(['#ffff00']))
  })

  it('rend un ensemble vide sans typologie', () => {
    expect(annotationColors(null).size).toBe(0)
  })
})

describe('annotatedPassages', () => {
  it('remonte un paragraphe entièrement surligné', () => {
    const data = {
      a: { texte: [{ type: 'paragraph', text: 'À reprendre entièrement.', highlight: '#ffff00' }] },
    }
    expect(annotatedPassages(NODES, data, HIGHLIGHTS)).toEqual([
      { id: 'a', titre: 'Chapitre I', path: '', phrase: 'À reprendre entièrement.', color: '#ffff00' },
    ])
  })

  it('remonte les portions marquées, une par marque', () => {
    const data = {
      b: {
        texte: [{
          type: 'paragraph',
          text: 'Début <mark data-hl="#ffff00">premier doute</mark> milieu '
            + '<mark data-hl="#ffff00">second doute</mark> fin.',
        }],
      },
    }
    const out = annotatedPassages(NODES, data, HIGHLIGHTS)
    expect(out.map((p) => p.phrase)).toEqual(['premier doute', 'second doute'])
    expect(out.every((p) => p.titre === 'Chapitre II' && p.path === 'Partie 1')).toBe(true)
  })

  it('écarte les couleurs qui ne sont pas des annotations', () => {
    const data = {
      a: {
        texte: [
          { type: 'paragraph', text: 'Appuyé <mark data-hl="#00ff00">en vert</mark>.' },
          { type: 'paragraph', text: 'Tout vert.', highlight: '#00ff00' },
        ],
      },
    }
    expect(annotatedPassages(NODES, data, HIGHLIGHTS)).toEqual([])
  })

  it('ignore la casse de la couleur relevée dans le .odt', () => {
    const data = { a: { texte: [{ type: 'paragraph', text: 'Doute.', highlight: '#FFFF00' }] } }
    expect(annotatedPassages(NODES, data, HIGHLIGHTS)).toHaveLength(1)
  })

  it('dépouille le balisage inline et les entités, replie les blancs', () => {
    const data = {
      a: {
        texte: [{
          type: 'paragraph',
          text: '<mark data-hl="#ffff00">un <strong>mot</strong>\n  &amp; un autre</mark>',
        }],
      },
    }
    expect(annotatedPassages(NODES, data, HIGHLIGHTS)[0].phrase).toBe('un mot & un autre')
  })

  it('borne un paragraphe long sans couper un mot en deux', () => {
    const long = `${'mot '.repeat(120)}fin`
    const data = { a: { texte: [{ type: 'paragraph', text: long, highlight: '#ffff00' }] } }
    const { phrase } = annotatedPassages(NODES, data, HIGHLIGHTS)[0]
    expect(phrase.length).toBeLessThanOrEqual(241)
    expect(phrase.endsWith('…')).toBe(true)
    expect(phrase).not.toMatch(/mo…$/)
  })

  it('laisse les listes de côté', () => {
    const data = {
      a: { texte: [{ type: 'list', ordered: false, items: [], highlight: '#ffff00' }] },
    }
    expect(annotatedPassages(NODES, data, HIGHLIGHTS)).toEqual([])
  })

  it('garde l’ordre de lecture : le nœud, puis le paragraphe', () => {
    const data = {
      a: { texte: [{ type: 'paragraph', text: 'un', highlight: '#ffff00' }] },
      b: {
        texte: [
          { type: 'paragraph', text: 'deux', highlight: '#ffff00' },
          { type: 'paragraph', text: '<mark data-hl="#ffff00">trois</mark>' },
        ],
      },
    }
    expect(annotatedPassages(NODES, data, HIGHLIGHTS).map((p) => p.phrase))
      .toEqual(['un', 'deux', 'trois'])
  })
})

describe('nodeCharCounts', () => {
  it('compte les caractères du texte propre, balisage exclu', () => {
    const data = { a: { texte: [{ type: 'paragraph', text: '<strong>abc</strong> de' }] } }
    expect(nodeCharCounts([NODES[0]], data)[0].chars).toBe(6)
  })

  it('rend 0 pour un nœud sans texte', () => {
    expect(nodeCharCounts(NODES, {})).toEqual([
      { ...NODES[0], chars: 0 },
      { ...NODES[1], chars: 0 },
    ])
  })
})
