import { describe, it, expect } from 'vitest'
import { buildParsedResult } from '../import/odt-parser/hierarchy'
import { harmonize } from '../import/odt-parser/harmonize'
import { FlatNode } from '../import/odt-parser'
import { DocumentTypology } from '../documents/typology'
import { DEFAULT_RULE_SET, DocumentRules, RuleSet } from '../documents/rules'
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

// Le cas nominal : un seul jeu de critères, aucun réglage par profondeur.
const rules = (over: Partial<RuleSet> = {}): DocumentRules => ({
  default: { ...DEFAULT_RULE_SET, ...over },
  byDepth: {},
})

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
    expect(r.judgedCount).toBe(1)
    expect(r.conformCount).toBe(1)
  })

  it('sans aucune règle active, tout est conforme', () => {
    const { trame, data } = build([H(1, 'Axe'), H(2, 'Vide')])
    const r = assessConformity(trame, data, typology, rules({ minChars: null, forbidAnnotations: false }))
    expect(r.criteria).toEqual([])
    expect(r.conformCount).toBe(1)
  })
})

describe('assessConformity — règles par profondeur', () => {
  const perDepth = (byDepth: DocumentRules['byDepth']): DocumentRules => ({
    default: { ...DEFAULT_RULE_SET, minChars: null, forbidAnnotations: false },
    byDepth,
  })

  it('applique à chaque niveau son propre jeu', () => {
    // Un axe et un article n'ont pas à contenir la même chose : l'axe doit
    // porter un chapeau, l'article être long.
    const { trame, data } = build([
      H(1, 'Axe'),
      P('intro courte', { effectiveStyle: 'Definition' }),
      H(2, 'Bloc'),
      H(3, 'Article'),
      P(long(), { effectiveStyle: 'Paragraphes' }),
    ])
    const r = assessConformity(trame, data, typology, perDepth({ 0: { ...DEFAULT_RULE_SET, minChars: null, forbidAnnotations: false, requiresRoles: ['définition'] }, 2: { ...DEFAULT_RULE_SET, forbidAnnotations: false } }))

    // L'axe est jugé bien qu'il ne soit pas une feuille : on l'a décrété pour
    // sa profondeur.
    expect(r.judgedCount).toBe(2)
    expect(r.conformCount).toBe(2)
    expect(r.failures).toEqual([])
  })

  it('juge un conteneur dès qu’un jeu vise sa profondeur', () => {
    const { trame, data } = build([H(1, 'Axe'), P('court'), H(2, 'Chapitre'), P(long())])
    const r = assessConformity(trame, data, typology, perDepth({ 0: { ...DEFAULT_RULE_SET, forbidAnnotations: false } }))

    expect(r.judgedCount).toBe(2) // l'axe (visé) + la feuille
    expect(r.failures.map((f) => f.titre)).toEqual(['Axe']) // 'court' < 500 caractères
  })

  it('étiquette les critères par niveau — une même clé à deux niveaux fait deux barres', () => {
    // Sans préfixe, « au moins 500 caractères » sur un axe et sur un article se
    // confondraient en une seule barre du graphe, mélangeant les échecs.
    const { trame, data } = build([H(1, 'Axe'), P('court'), H(2, 'Chapitre'), P('court aussi')])
    const set = { ...DEFAULT_RULE_SET, forbidAnnotations: false }
    const r = assessConformity(trame, data, typology, perDepth({ 0: set, 1: set }))

    expect(r.criteria.map((c) => c.key)).toEqual(['0|minChars', '1|minChars'])
    expect(r.criteria.map((c) => c.label)).toEqual([
      'Niveau 1 — au moins 500 caractères',
      'Niveau 2 — au moins 500 caractères',
    ])
    expect(r.criteria.every((c) => c.failing === 1)).toBe(true)
  })

  it('regroupe toutes les profondeurs ≥ 2 sous un seul jeu', () => {
    const { trame, data } = build([H(1, 'A'), H(2, 'B'), H(3, 'C'), P('court'), H(4, 'D'), P('court')])
    const r = assessConformity(trame, data, typology, perDepth({ 2: { ...DEFAULT_RULE_SET, forbidAnnotations: false } }))

    expect(r.criteria.map((c) => c.key)).toEqual(['2|minChars'])
    expect(r.criteria[0].label).toBe('Niveau 3+ — au moins 500 caractères')
    expect(r.criteria[0].failing).toBe(2) // C (depth 2) et D (depth 3)
  })

  it('n’étiquette PAS les critères sans réglage par profondeur', () => {
    // Le graphe du dashboard doit garder exactement ses barres d'avant pour les
    // documents qui n'ont rien réglé.
    const { trame, data } = build([H(1, 'Axe'), H(2, 'Chapitre'), P('court')])
    const r = assessConformity(trame, data, typology, rules({ forbidAnnotations: false }))
    expect(r.criteria.map((c) => c.key)).toEqual(['minChars'])
    expect(r.criteria[0].label).toBe('au moins 500 caractères')
  })
})
