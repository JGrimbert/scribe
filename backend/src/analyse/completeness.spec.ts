import { describe, it, expect } from 'vitest'
import { buildParsedResult } from '../import/odt-parser/hierarchy'
import { harmonize } from '../import/odt-parser/harmonize'
import { FlatNode } from '../import/odt-parser'
import {
  assessCompleteness,
  stubNodeIds,
  CompletenessDisplayStatus,
  CompletenessGroup,
} from './completeness'
import { nodeContentHash } from './plain-text'

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

// Le groupe « Total » ferme toujours la distribution (cf. assessCompleteness).
const totalGroup = (distribution: CompletenessGroup[]) => distribution[distribution.length - 1]

const countOf = (distribution: CompletenessGroup[], status: CompletenessDisplayStatus) =>
  totalGroup(distribution).distribution.find((s) => s.status === status)!.count

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

  it('répartit les feuilles sur toute l’échelle, parts à 0 comprises', () => {
    const { trame, data } = build([
      H(1, 'Axe'),
      H(2, 'Chapitre rédigé'),
      P(words(200)),
      H(2, 'Chapitre en attente'),
      P('trois petits mots'),
      H(2, 'Chapitre vide'),
    ])

    const { distribution } = assessCompleteness(trame, data)
    expect(totalGroup(distribution)).toEqual({
      nodeId: null,
      titre: 'Total',
      leafCount: 3,
      distribution: [
        { status: 'vide', count: 1 },
        { status: 'ébauche', count: 1 },
        { status: 'partiel', count: 0 },
        { status: 'rédigé', count: 1 },
        // Sans validation en base, les deux états humains restent à 0 — mais
        // présents : la légende du graphe ne doit pas changer de forme.
        { status: 'validé', count: 0 },
        { status: 'périmé', count: 0 },
      ],
    })
  })

  it('ventile par axe de tête, puis totalise', () => {
    const { trame, data } = build([
      H(1, 'Axe rédigé'),
      H(2, 'Chapitre A'),
      P(words(200)),
      H(1, 'Axe en retard'),
      H(2, 'Chapitre B'),
      P('trop court'),
      H(2, 'Chapitre C'),
    ])

    const { distribution } = assessCompleteness(trame, data)
    expect(distribution.map((g) => [g.titre, g.leafCount])).toEqual([
      ['Axe rédigé', 1],
      ['Axe en retard', 2],
      ['Total', 3],
    ])
    expect(distribution[1].distribution).toEqual([
      { status: 'vide', count: 1 },
      { status: 'ébauche', count: 1 },
      { status: 'partiel', count: 0 },
      { status: 'rédigé', count: 0 },
      { status: 'validé', count: 0 },
      { status: 'périmé', count: 0 },
    ])
  })

  it('n’étiquette pas un conteneur sans préambule comme anomalie', () => {
    const { trame, data } = build([H(1, 'Axe sans intro'), H(2, 'Chapitre'), P(words(200))])
    const { anomalies } = assessCompleteness(trame, data)
    expect(anomalies).toHaveLength(0)
  })

  describe('validation manuelle', () => {
    const doc = () =>
      build([H(1, 'Axe'), H(2, 'Chapitre relu'), P(words(200)), H(2, 'Chapitre brut'), P(words(200))])

    it('affiche « validé » tant que le texte n’a pas bougé', () => {
      const { trame, data } = doc()
      const reluId = trame.axes[0].children[0].id
      const validations = new Map([[reluId, nodeContentHash(data[reluId].texte)]])

      const { distribution } = assessCompleteness(trame, data, validations)
      expect(countOf(distribution, 'validé')).toBe(1)
      expect(countOf(distribution, 'périmé')).toBe(0)
      expect(countOf(distribution, 'rédigé')).toBe(1) // l'autre chapitre reste calculé
    })

    it('bascule en « périmé » quand le texte a changé depuis la relecture', () => {
      const { trame, data } = doc()
      const reluId = trame.axes[0].children[0].id
      const validations = new Map([[reluId, 'hash-d-une-version-anterieure']])

      const { distribution } = assessCompleteness(trame, data, validations)
      expect(countOf(distribution, 'périmé')).toBe(1)
      expect(countOf(distribution, 'validé')).toBe(0)
    })

    it('ne périme pas une relecture sur un simple changement de mise en forme', () => {
      const { trame, data } = doc()
      const reluId = trame.axes[0].children[0].id
      const validations = new Map([[reluId, nodeContentHash(data[reluId].texte)]])

      // Même texte, un mot passé en gras : le hash porte sur le texte brut.
      const entry = data[reluId].texte[0]
      if (entry.type !== 'paragraph') throw new Error('le fixture pose un paragraphe')
      entry.text = entry.text.replace('mot', '<strong>mot</strong>')

      const { distribution } = assessCompleteness(trame, data, validations)
      expect(countOf(distribution, 'validé')).toBe(1)
    })

    it('retire des anomalies un chapitre stub validé tel quel', () => {
      const { trame, data } = build([H(1, 'Axe'), H(2, 'Volontairement bref'), P('deux mots')])
      const briefId = trame.axes[0].children[0].id

      expect(assessCompleteness(trame, data).anomalies).toHaveLength(1)

      const validations = new Map([[briefId, nodeContentHash(data[briefId].texte)]])
      const validated = assessCompleteness(trame, data, validations)
      expect(validated.anomalies).toHaveLength(0)
      expect(countOf(validated.distribution, 'validé')).toBe(1)
    })

    it('garde en anomalie un chapitre stub dont la validation est périmée', () => {
      const { trame, data } = build([H(1, 'Axe'), H(2, 'Vidé depuis'), P('deux mots')])
      const nodeId = trame.axes[0].children[0].id
      const validations = new Map([[nodeId, 'hash-perime']])

      const { anomalies, distribution } = assessCompleteness(trame, data, validations)
      expect(anomalies).toHaveLength(1)
      expect(countOf(distribution, 'périmé')).toBe(1)
    })
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
