import { describe, it, expect, vi } from 'vitest'
import { harmonize } from './harmonize'
import { buildParsedResult } from './hierarchy'
import { FlatNode } from './types'

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

const H = (level: number, text: string, extra: Partial<FlatNode> = {}): Partial<FlatNode> => ({ kind: 'heading', level, text, ...extra })
const P = (text: string): Partial<FlatNode> => ({ kind: 'paragraph', text })

function harmonizeFlat(nodes: Partial<FlatNode>[]) {
  const { result, bookmarks } = buildParsedResult(flat(nodes), {}, 0)
  return harmonize(result, bookmarks)
}

describe('harmonize', () => {
  it('produit data + trame avec un level = profondeur pour chaque nœud', () => {
    const { data, trame } = harmonizeFlat([H(1, 'Axe'), H(2, 'Bloc')])

    const axeId = trame.axes[0].id
    const blocId = trame.axes[0].children[0].id
    expect(data[axeId]).toMatchObject({ titre: 'Axe', level: 0 })
    expect(data[blocId]).toMatchObject({ titre: 'Bloc', level: 1 })
  })

  it('nettoie les stats (retire status et paragraphes)', () => {
    const { data, trame } = harmonizeFlat([H(1, 'Axe'), P('un deux trois')])
    const stats = data[trame.axes[0].id].stats
    expect(stats).toEqual({ mots: 3, caracteres: 11 })
    expect(stats).not.toHaveProperty('status')
    expect(stats).not.toHaveProperty('paragraphes')
  })

  it('construit connexe seulement s’il y a tableau ou pistes', () => {
    const sansConnexe = harmonizeFlat([H(1, 'A'), P('rien')])
    expect(sansConnexe.data[sansConnexe.trame.axes[0].id].connexe).toBeNull()

    const avecTableau = harmonizeFlat([H(1, 'A'), { index: 0, kind: 'table', tableData: [['x']] }])
    expect(avecTableau.data[avecTableau.trame.axes[0].id].connexe).toEqual({ tableau: [['x']], pistes: [] })
  })

  it('résout un lien interne vers l’id du nœud cible', () => {
    const { data, trame } = harmonizeFlat([H(1, 'Cible', { bookmarkNames: ['sig1'] }), P('voir <a data-bookmark="sig1">ici</a>')])
    const cibleId = trame.axes[0].id
    expect(data[cibleId].texte[0]).toEqual({
      type: 'paragraph',
      text: `voir <a href="internal:${cibleId}" class="lien-interne">ici</a>`,
    })
  })

  it('laisse un lien vers un signet inconnu en texte brut, avec un warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { data, trame } = harmonizeFlat([H(1, 'A'), P('voir <a data-bookmark="ghost">ici</a>')])
    expect(data[trame.axes[0].id].texte[0]).toEqual({ type: 'paragraph', text: 'voir ici' })
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
