import { describe, it, expect } from 'vitest'
import { buildImpositionBlocks } from './paginate.js'

describe('buildImpositionBlocks', () => {
  it('rend une page de contenu par entrée, styleName préservé, sans titre', () => {
    const blocks = buildImpositionBlocks([
      { kind: 'content', entries: [
        { type: 'paragraph', text: 'Alpha', styleName: 'Dédicace' },
        { type: 'paragraph', text: 'Bêta', styleName: 'Dédicace' },
      ] },
    ])
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ styleName: 'Dédicace', html: '<p>Alpha</p>' })
    expect(blocks.some((b) => b.type === 'title')).toBe(false)
  })

  it('force un saut de page au 1er bloc de chaque slot sauf le premier', () => {
    const blocks = buildImpositionBlocks([
      { kind: 'content', entries: [{ text: 'a' }, { text: 'b' }] },
      { kind: 'content', entries: [{ text: 'c' }] },
    ])
    // slot 0 : aucun saut ; slot 1 : saut sur son 1er (et unique) bloc.
    expect(blocks[0].breakBefore).toBeFalsy()
    expect(blocks[1].breakBefore).toBeFalsy()
    expect(blocks[2].breakBefore).toBe(true)
  })

  it('rend une page réelle vide (libellée) pour blank / cover / empty', () => {
    const blocks = buildImpositionBlocks([
      { kind: 'blank', label: 'Page blanche' },
      { kind: 'cover', label: 'Page de garde' },
      { kind: 'empty' },
    ])
    expect(blocks).toHaveLength(3)
    expect(blocks[0].html).toContain('imp-slot--blank')
    expect(blocks[0].html).toContain('Page blanche')
    expect(blocks[1].html).toContain('imp-slot--cover')
    expect(blocks[2].html).toContain('imp-slot--empty')
    // Pas de libellé sur une page vide de format.
    expect(blocks[2].html).not.toContain('imp-slot-label')
    // Sauts : slots 1 et 2 forcent leur page.
    expect(blocks[0].breakBefore).toBeFalsy()
    expect(blocks[1].breakBefore).toBe(true)
    expect(blocks[2].breakBefore).toBe(true)
  })

  it('retombe sur une page vide si un slot de contenu n\'a aucune entrée', () => {
    const blocks = buildImpositionBlocks([{ kind: 'content', entries: [] }])
    expect(blocks).toHaveLength(1)
    expect(blocks[0].html).toContain('imp-slot--empty')
  })

  it('tolère une liste de pages absente', () => {
    expect(buildImpositionBlocks()).toEqual([])
    expect(buildImpositionBlocks(null)).toEqual([])
  })
})
