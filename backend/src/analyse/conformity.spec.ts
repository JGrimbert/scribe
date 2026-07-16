import { describe, it, expect } from 'vitest'
import { buildParsedResult } from '../import/odt-parser/hierarchy'
import { harmonize } from '../import/odt-parser/harmonize'
import { FlatNode } from '../import/odt-parser'
import { DocumentTypology } from '../documents/typology'
import { DEFAULT_RULES, DocumentRules } from '../documents/rules'
import { assessConformity } from './conformity'

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

const H = (level: number, text: string): Partial<FlatNode> => ({ kind: 'heading', level, text })
const P = (text: string, extra: Partial<FlatNode> = {}): Partial<FlatNode> => ({ kind: 'paragraph', text, ...extra })
const TABLE = (): Partial<FlatNode> => ({ kind: 'table', tableData: [['Zorro', 'Grimr']] })
const long = (n = 600) => 'x'.repeat(n)

function build(nodes: Partial<FlatNode>[]) {
  const { result, bookmarks } = buildParsedResult(flat(nodes), {}, 0)
  return harmonize(result, bookmarks)
}

const typology: DocumentTypology = {
  styles: { Paragraphes: 'corps', Definition: 'définition' },
  highlights: { '#ffff00': 'annotation', '#ffe994': 'emphase' },
}

const rules = (over: Partial<DocumentRules> = {}): DocumentRules => ({ ...DEFAULT_RULES, ...over })

describe('assessConformity', () => {
  it('ne dit rien tant que la typologie n’est pas arbitrée', () => {
    const { trame, data } = build([H(1, 'Axe'), H(2, 'Chapitre'), P(long())])
    const r = assessConformity(trame, data, null, rules())
    expect(r.available).toBe(false)
    expect(r.criteria).toEqual([])
    expect(r.failures).toEqual([])
  })

  it('compte conforme un chapitre long et sans annotation', () => {
    const { trame, data } = build([H(1, 'Axe'), H(2, 'Chapitre'), P(long(), { effectiveStyle: 'Paragraphes' })])
    const r = assessConformity(trame, data, typology, rules())
    expect(r.available).toBe(true)
    expect(r.conformCount).toBe(1)
    expect(r.failures).toEqual([])
  })

  it('recense le chapitre trop court avec le critère en cause', () => {
    const { trame, data } = build([H(1, 'Axe'), H(2, 'Bref'), P('trois mots')])
    const r = assessConformity(trame, data, typology, rules())
    expect(r.conformCount).toBe(0)
    expect(r.failures[0]).toMatchObject({ titre: 'Bref', failed: ['minChars'] })
    expect(r.criteria.find((c) => c.key === 'minChars')!.failing).toBe(1)
  })

  it('refuse un chapitre portant un surlignage typé annotation', () => {
    const { trame, data } = build([
      H(1, 'Axe'),
      H(2, 'Annoté'),
      P(long(), { highlight: '#ffff00' }),
    ])
    const r = assessConformity(trame, data, typology, rules())
    expect(r.failures[0].failed).toEqual(['annotations'])
  })

  it('ignore un surlignage typé autrement qu’annotation', () => {
    const { trame, data } = build([H(1, 'Axe'), H(2, 'Mis en avant'), P(long(), { highlight: '#ffe994' })])
    expect(assessConformity(trame, data, typology, rules()).conformCount).toBe(1)
  })

  it('repère une annotation INLINE, invisible du texte brut', () => {
    // Le marqueur ne survit que dans le texte : plainNodeText l'efface, donc
    // un test assis dessus ne verrait jamais cette annotation-là.
    const { trame, data } = build([
      H(1, 'Axe'),
      H(2, 'Annoté au milieu'),
      P(`${long()} <mark data-hl="#ffff00">à reprendre</mark>`),
    ])
    expect(assessConformity(trame, data, typology, rules()).failures[0].failed).toEqual(['annotations'])
  })

  it('cherche le tableau dans connexe, pas dans texte[]', () => {
    // Régression : les paragraphes d'un tableau sont aplatis dans
    // connexe.tableau et n'apparaissent JAMAIS dans texte[] — sur le manuscrit
    // témoin, un critère assis sur les rôles mesurait 0 tableau sur 824
    // chapitres alors que 35 en portent un.
    const { trame, data } = build([H(1, 'Axe'), H(2, 'Avec tableau'), P(long()), TABLE()])
    const withTable = assessConformity(trame, data, typology, rules({ requiresTable: true }))
    expect(withTable.conformCount).toBe(1)

    const { trame: t2, data: d2 } = build([H(1, 'Axe'), H(2, 'Sans tableau'), P(long())])
    expect(assessConformity(t2, d2, typology, rules({ requiresTable: true })).failures[0].failed).toEqual(['table'])
  })

  it('exige un rôle donné (définition)', () => {
    const { trame, data } = build([
      H(1, 'Axe'),
      H(2, 'Avec définition'),
      P(long(), { effectiveStyle: 'Paragraphes' }),
      P('A.− ZOOL. Petit mammifère', { effectiveStyle: 'Definition' }),
    ])
    const r = assessConformity(trame, data, typology, rules({ requiresRoles: ['définition'] }))
    expect(r.conformCount).toBe(1)

    const { trame: t2, data: d2 } = build([H(1, 'Axe'), H(2, 'Sans'), P(long(), { effectiveStyle: 'Paragraphes' })])
    const r2 = assessConformity(t2, d2, typology, rules({ requiresRoles: ['définition'] }))
    expect(r2.failures[0].failed).toEqual(['role:définition'])
    expect(r2.criteria.find((c) => c.key === 'role:définition')!.label).toBe('un paragraphe « définition »')
  })

  it('cumule les critères manquants sur un même chapitre', () => {
    const { trame, data } = build([H(1, 'Axe'), H(2, 'Tout faux'), P('court', { highlight: '#ffff00' })])
    const r = assessConformity(trame, data, typology, rules({ requiresTable: true, requiresRoles: ['définition'] }))
    expect(r.failures[0].failed).toEqual(['minChars', 'annotations', 'table', 'role:définition'])
  })

  it('ne juge que les feuilles — un conteneur n’a pas à porter de définition', () => {
    const { trame, data } = build([H(1, 'Axe'), P('intro courte'), H(2, 'Chapitre'), P(long())])
    const r = assessConformity(trame, data, typology, rules())
    expect(r.leafCount).toBe(1)
    expect(r.conformCount).toBe(1)
  })

  it('sans aucune règle active, tout est conforme', () => {
    const { trame, data } = build([H(1, 'Axe'), H(2, 'Vide')])
    const r = assessConformity(trame, data, typology, rules({ minChars: null, forbidAnnotations: false }))
    expect(r.criteria).toEqual([])
    expect(r.conformCount).toBe(1)
  })
})
