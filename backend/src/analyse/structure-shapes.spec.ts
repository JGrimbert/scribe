import { describe, it, expect } from 'vitest'
import { collectShapes, toRuns } from './structure-shapes'
import { DataMap, TrameNode } from '../import/odt-parser'

const P = (text: string, styleName?: string, highlight?: string) => ({
  type: 'paragraph' as const,
  text,
  ...(styleName ? { styleName } : {}),
  ...(highlight ? { highlight } : {}),
})

function item(id: string, titre: string, texte: any[], level = 0): DataMap[string] {
  return { id, level, titre, slug: id, texte, connexe: null, indexGlobal: null, stats: null }
}

const node = (id: string, children: TrameNode[] = []): TrameNode => ({ id, children })

describe('toRuns', () => {
  it('fusionne les répétitions consécutives', () => {
    expect(toRuns(['corps', 'corps', 'corps'])).toEqual([['corps', 3]])
  })

  it('garde l’ordre : deux runs séparés ne fusionnent pas', () => {
    // « chapeau puis corps » n'est pas la même forme que « corps puis chapeau »,
    // et « corps chapeau corps » n'est pas « corps ×2 chapeau ».
    expect(toRuns(['corps', 'chapeau', 'corps'])).toEqual([
      ['corps', 1],
      ['chapeau', 1],
      ['corps', 1],
    ])
  })

  it('rend une liste vide pour un nœud sans texte', () => {
    expect(toRuns([])).toEqual([])
  })
})

describe('collectShapes', () => {
  const data: DataMap = {
    axe: item('axe', 'La Lisière', [P('intro', 'intro')]),
    bloc: item('bloc', 'Le Jeu', [P('chapeau', 'Chapeau Chapitre')], 1),
    art1: item('art1', 'Le Fil Rouge', [P('a', 'Paragraphes'), P('b', 'Paragraphes'), P('c', 'Voir')], 2),
    art2: item('art2', 'Le Fil Blanc', [P('a', 'Paragraphes'), P('b', 'Paragraphes'), P('c', 'Voir')], 2),
  }
  const trame = { axes: [node('axe', [node('bloc', [node('art1'), node('art2')])])] }

  it('rend chaque nœud dans l’ordre du document, avec sa profondeur', () => {
    const { shapes } = collectShapes(trame, data)
    expect(shapes.map((s) => [s.titre, s.depth])).toEqual([
      ['La Lisière', 0],
      ['Le Jeu', 1],
      ['Le Fil Rouge', 2],
      ['Le Fil Blanc', 2],
    ])
  })

  it('inclut les conteneurs, pas seulement les feuilles', () => {
    // Contrairement à completeness/conformity : « à quoi ressemble un axe ? »
    // est une question aussi légitime que « à quoi ressemble un article ? ».
    const { shapes } = collectShapes(trame, data)
    expect(shapes.find((s) => s.nodeId === 'axe')).toMatchObject({ isLeaf: false, runs: [['intro', 1]] })
    expect(shapes.find((s) => s.nodeId === 'art1')).toMatchObject({ isLeaf: true })
  })

  it('compresse la séquence de styles en runs', () => {
    const { shapes } = collectShapes(trame, data)
    expect(shapes.find((s) => s.nodeId === 'art1')?.runs).toEqual([
      ['Paragraphes', 2],
      ['Voir', 1],
    ])
  })

  it('deux nœuds de même forme produisent des runs identiques', () => {
    // La promesse du lot : c'est cette égalité qui fera émerger un modèle.
    const { shapes } = collectShapes(trame, data)
    const art1 = shapes.find((s) => s.nodeId === 'art1')
    const art2 = shapes.find((s) => s.nodeId === 'art2')
    expect(art1?.runs).toEqual(art2?.runs)
  })

  it('relève les surlignages du nœud, dédoublonnés (paragraphe ET inline)', () => {
    const d: DataMap = {
      a: item('a', 'A', [
        P('à reprendre', 'Paragraphes', '#ffff00'),
        P('un <mark data-hl="#FFFF00">bout</mark> et <mark data-hl="#ffe994">autre</mark>', 'Paragraphes'),
      ]),
    }
    const { shapes } = collectShapes({ axes: [node('a')] }, d)
    // Casse normalisée, une couleur une fois : la présence est un fait binaire.
    expect(shapes[0].highlights.sort()).toEqual(['#ffe994', '#ffff00'])
  })

  it('un nœud sans style (import ancien) donne un run de style vide, pas un trou', () => {
    const d: DataMap = { a: item('a', 'A', [P('texte sans style')]) }
    const { shapes } = collectShapes({ axes: [node('a')] }, d)
    expect(shapes[0].runs).toEqual([['', 1]])
  })

  it('ignore une référence de trame sans données plutôt que de planter', () => {
    const { shapes } = collectShapes({ axes: [node('fantome')] }, {})
    expect(shapes).toEqual([])
  })
})
