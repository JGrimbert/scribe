import { describe, it, expect } from 'vitest'
import { buildOutline, suggestStructureEndIndex, suggestStructureStartIndex } from './calibration'
import { FlatNode, OutlineEntry } from './types'

function flat(nodes: Partial<FlatNode>[]): FlatNode[] {
  return nodes.map((n, index) => ({
    index,
    kind: 'paragraph',
    level: 0,
    text: '',
    styleName: '',
    effectiveStyle: '',
    highlight: null,
    hasPageBreak: false,
    ...n,
  })) as FlatNode[]
}

describe('buildOutline', () => {
  it('ne garde que les titres non vides et reporte niveau/index/saut de page', () => {
    const outline = buildOutline(
      flat([
        { kind: 'heading', level: 1, text: 'Axe', hasPageBreak: true },
        { kind: 'paragraph', text: 'du texte' }, // exclu
        { kind: 'heading', level: 2, text: '' }, // exclu (titre vide)
        { kind: 'heading', level: 2, text: 'Bloc' },
      ]),
    )
    expect(outline).toEqual([
      { index: 0, level: 1, text: 'Axe', empty: false, hasPageBreak: true },
      { index: 3, level: 2, text: 'Bloc', empty: false, hasPageBreak: false },
    ])
  })
})

describe('suggestStructureStartIndex', () => {
  const outline = (entries: Array<Partial<OutlineEntry>>): OutlineEntry[] =>
    entries.map((e, i) => ({ index: i, level: 1, text: '', empty: false, hasPageBreak: false, ...e }))

  it('renvoie l’index du premier titre présent dans la table des matières', () => {
    const o = outline([{ index: 5, text: 'Préface' }, { index: 9, text: 'Sylvestres' }])
    // La ToC préfixe souvent d'une numérotation ("1.Sylvestres") → match par suffixe.
    expect(suggestStructureStartIndex(o, ['1.Sylvestres', '2.Autres'])).toBe(9)
  })

  it('retombe sur le premier titre si la ToC est vide', () => {
    const o = outline([{ index: 4, text: 'Quoi' }])
    expect(suggestStructureStartIndex(o, [])).toBe(4)
  })

  it('retombe sur le premier titre si aucun titre ne correspond', () => {
    const o = outline([{ index: 2, text: 'Rien à voir' }])
    expect(suggestStructureStartIndex(o, ['Autre chose'])).toBe(2)
  })

  it('ignore les titres de moins de 3 caractères', () => {
    const o = outline([{ index: 0, text: 'Ax' }, { index: 1, text: 'Vrai' }])
    expect(suggestStructureStartIndex(o, ['Ax', '3.Vrai'])).toBe(1)
  })

  it('renvoie 0 sur un outline vide', () => {
    expect(suggestStructureStartIndex([], ['quoi'])).toBe(0)
  })
})

describe('suggestStructureEndIndex', () => {
  const outline = (entries: Array<Partial<OutlineEntry>>): OutlineEntry[] =>
    entries.map((e, i) => ({ index: i, level: 1, text: '', empty: false, hasPageBreak: false, ...e }))

  it('retient un titre d’appareil de fin situé dans le dernier tiers', () => {
    const o = outline([
      { index: 0, text: 'Un' },
      { index: 1, text: 'Deux' },
      { index: 2, text: 'Trois' },
      { index: 3, text: 'Table des matières' },
    ])
    expect(suggestStructureEndIndex(o)).toBe(3)
  })

  it('ignore un chapitre nommé « Index » hors du dernier tiers', () => {
    const o = outline([{ index: 0, text: 'Index' }, { index: 1, text: 'Deux' }, { index: 2, text: 'Trois' }])
    expect(suggestStructureEndIndex(o)).toBeUndefined()
  })

  // Le cas qui a fait abandonner le croisement avec la table des matières :
  // sur le manuscrit témoin, les deux derniers titres ne figurent pas dans une
  // ToC périmée. Les prendre pour l'appareil de fin ampute le livre de deux
  // articles, en silence.
  it('ne prend pas des chapitres absents de la ToC pour une partie finale', () => {
    const o = outline([
      { index: 0, text: 'La Lisière' },
      { index: 1, text: 'Derniers mots' },
      { index: 2, text: 'Octogramme' },
      { index: 3, text: 'Pentacle' },
    ])
    expect(suggestStructureEndIndex(o)).toBeUndefined()
  })

  it('ne suggère rien sur un outline vide', () => {
    expect(suggestStructureEndIndex([])).toBeUndefined()
  })
})
