import { describe, it, expect } from 'vitest'
import { corpsMergeCandidates, deviationStyleRows, dominantRank, mergeCandidates, styleRanks } from './chapitrageFusion'

const node = (nodeId, runs) => ({ nodeId, titre: nodeId, shape: { nodeId, runs } })
const MODEL = ['Heading 3', 'Definition', 'Paragraphes']
const titleStyleOf = () => 'Heading 3'

// Le cas du témoin : « Definition » (rare, dans le modèle) et « mention sous
// titre » (répandue) occupent le rang 1 et ne se croisent jamais.
const CORPUS = [
  node('conforme', [['Definition', 1], ['Paragraphes', 9]]),
  node('a', [['mention sous titre', 1], ['Paragraphes', 12]]),
  node('b', [['mention sous titre', 1], ['Paragraphes', 4]]),
  node('c', [['mention sous titre', 1], ['Paragraphes', 7]]),
]

describe('styleRanks', () => {
  it('relève les rangs d’apparition, leur fréquence et les nœuds porteurs', () => {
    const r = styleRanks(CORPUS, titleStyleOf)
    expect([...r.get('Heading 3').ranks]).toEqual([[0, 4]])
    expect([...r.get('Definition').ranks]).toEqual([[1, 1]])
    expect([...r.get('mention sous titre').ranks]).toEqual([[1, 3]])
    expect(r.get('mention sous titre').count).toBe(3)
  })
})

describe('dominantRank', () => {
  it('rend le rang le plus fréquent et sa part', () => {
    // Un style à sa place dans 9 nœuds sur 10 garde un rang dominant net.
    const nodes = [
      ...Array.from({ length: 9 }, (_, i) => node(`n${i}`, [['X', 1], ['Paragraphes', 2]])),
      node('exception', [['Paragraphes', 2], ['X', 1]]),
    ]
    expect(dominantRank(styleRanks(nodes, titleStyleOf).get('X'))).toEqual({ rank: 1, share: 0.9 })
  })
})

describe('mergeCandidates', () => {
  it('propose la paire même-rang / jamais coprésente, et garde le nom du MODÈLE', () => {
    const [best] = mergeCandidates(CORPUS, MODEL, titleStyleOf)
    expect(best).toMatchObject({ keep: 'Definition', drop: 'mention sous titre', rank: 1 })
    // 1 nœud conforme avant, 4 après : la fusion en rallie 3.
    expect(best.gain).toBe(3)
  })

  it('écarte deux styles qui se côtoient dans un même nœud', () => {
    const corpus = [
      node('x', [['Definition', 1], ['Paragraphes', 2]]),
      node('y', [['Definition', 1], ['mention sous titre', 1], ['Paragraphes', 2]]),
    ]
    expect(mergeCandidates(corpus, MODEL, titleStyleOf)).toEqual([])
  })

  it('écarte deux styles qui n’occupent pas le même rang', () => {
    const corpus = [
      node('x', [['Definition', 1], ['Paragraphes', 2]]),
      node('y', [['Paragraphes', 2], ['Chapeau', 1]]), // Chapeau au rang 2, pas 1
    ]
    expect(mergeCandidates(corpus, MODEL, titleStyleOf).some((c) => c.drop === 'Chapeau')).toBe(false)
  })

  it('tolère les exceptions marginales — un vrai livre n’est jamais unanime', () => {
    // « mention sous titre » au rang 1 partout SAUF un chapitre où elle glisse au
    // rang 2 : la paire doit tenir (533/536 sur le témoin).
    const corpus = [
      ...CORPUS,
      ...Array.from({ length: 20 }, (_, i) => node(`m${i}`, [['mention sous titre', 1], ['Paragraphes', 3]])),
      node('exception', [['Paragraphes', 3], ['mention sous titre', 1]]),
    ]
    const [best] = mergeCandidates(corpus, MODEL, titleStyleOf)
    expect(best).toMatchObject({ keep: 'Definition', drop: 'mention sous titre', rank: 1, copresent: 0 })
  })

  it('hors modèle, c’est le plus répandu qui absorbe l’autre', () => {
    const corpus = [
      node('x', [['Alpha', 1]]),
      node('y', [['Alpha', 1]]),
      node('z', [['Beta', 1]]),
    ]
    const cand = mergeCandidates(corpus, [], titleStyleOf).find((c) => c.drop === 'Beta')
    expect(cand).toMatchObject({ keep: 'Alpha', drop: 'Beta', keptCount: 2, droppedCount: 1 })
  })

  it('aucun nœud : aucune proposition', () => {
    expect(mergeCandidates([], MODEL, titleStyleOf)).toEqual([])
  })
})

describe('corpsMergeCandidates', () => {
  // « Paragraphes » et « Text body » : deux styles de CORPS qui cohabitent dans un
  // même chapitre et à tous les rangs — invisibles à mergeCandidates.
  const roleOf = (name) => (name === 'Paragraphes' || name === 'Text body' ? 'corps' : name === 'Heading 3' ? 'titre' : '?')
  const CORPUS = [
    node('conforme', [['Paragraphes', 3]]),
    node('mix', [['Paragraphes', 2], ['Text body', 1], ['Paragraphes', 4]]), // les deux, entremêlés
    node('autre', [['Text body', 5]]),
  ]

  it('propose la paire de corps que rang/copresence rejetteraient, et garde le nom du MODÈLE', () => {
    // mergeCandidates ne voit rien (copresence + pas de rang fixe)…
    expect(mergeCandidates(CORPUS, MODEL, titleStyleOf)).toEqual([])
    // …corpsMergeCandidates, si : le rôle partagé suffit.
    const [best] = corpsMergeCandidates(CORPUS, roleOf, MODEL, titleStyleOf)
    expect(best).toMatchObject({ keep: 'Paragraphes', drop: 'Text body' })
    expect(best.collapsed).toBeGreaterThan(0)
  })

  it('ignore les styles hors rôle corps', () => {
    const corpus = [node('x', [['Definition', 1], ['Paragraphes', 2]])]
    // Definition n'est pas corps → aucune paire.
    expect(corpsMergeCandidates(corpus, roleOf, MODEL, titleStyleOf)).toEqual([])
  })

  it('un seul style de corps typé : rien à fondre', () => {
    const corpus = [node('x', [['Paragraphes', 2]]), node('y', [['Text body', 2]])]
    const solo = (name) => (name === 'Paragraphes' ? 'corps' : '?') // Text body pas encore arbitré
    expect(corpsMergeCandidates(corpus, solo, MODEL, titleStyleOf)).toEqual([])
  })

  it('hors modèle, le plus répandu absorbe l’autre', () => {
    const corpus = [
      node('x', [['Alpha', 3]]),
      node('y', [['Alpha', 2]]),
      node('z', [['Beta', 1]]),
    ]
    const bodyOf = (name) => (name === 'Alpha' || name === 'Beta' ? 'corps' : '?')
    const [best] = corpsMergeCandidates(corpus, bodyOf, [], () => null)
    expect(best).toMatchObject({ keep: 'Alpha', drop: 'Beta', keptCount: 2, droppedCount: 1 })
  })
})

describe('deviationStyleRows', () => {
  const roleOf = () => '?'

  it('une ligne par style hors modèle, part du problème + cible de fusion', () => {
    const rows = deviationStyleRows(CORPUS, roleOf, MODEL, titleStyleOf)
    // « mention sous titre » est le seul style hors modèle (Definition/Heading 3/
    // Paragraphes sont au modèle) : 3 nœuds le portent, tous non conformes.
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'mention sous titre', count: 3, keep: 'Definition', gain: 3 })
    // 3 chapitres non conformes, les 3 portent le style → 100 % du problème.
    expect(rows[0].problemShare).toBe(1)
  })

  it('les styles du modèle n’ont pas de ligne', () => {
    const rows = deviationStyleRows(CORPUS, roleOf, MODEL, titleStyleOf)
    expect(rows.some((r) => MODEL.includes(r.name))).toBe(false)
  })

  it('un style hors modèle sans cible de fusion : pas de keep/gain', () => {
    // « Chapeau » au rang 2 (jamais le rang de Definition) → aucun candidat ne le
    // fond, mais il reste une ligne (avec sa part du problème).
    const corpus = [
      node('a', [['mention sous titre', 1], ['Paragraphes', 2]]),
      node('b', [['Paragraphes', 2], ['Chapeau', 1]]),
    ]
    const row = deviationStyleRows(corpus, roleOf, MODEL, titleStyleOf).find((r) => r.name === 'Chapeau')
    expect(row).toMatchObject({ keep: null, gain: null, count: 1 })
  })

  it('trie par part du problème décroissante', () => {
    const rows = deviationStyleRows(
      [
        node('a', [['Rare', 1], ['Paragraphes', 2]]),
        node('b', [['Fréquent', 1], ['Paragraphes', 2]]),
        node('c', [['Fréquent', 1], ['Paragraphes', 2]]),
      ],
      roleOf, MODEL, titleStyleOf,
    )
    expect(rows.map((r) => r.name)).toEqual(['Fréquent', 'Rare'])
  })

  it('aucun nœud : aucune ligne', () => {
    expect(deviationStyleRows([], roleOf, MODEL, titleStyleOf)).toEqual([])
  })
})
