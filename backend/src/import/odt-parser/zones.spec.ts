import { describe, it, expect } from 'vitest'
import { buildParsedResult } from './hierarchy'
import { ventilateInventory, zoneOfDepth } from './zones'
import { FlatNode, ImportCorrections, StyleInventory } from './types'

function flat(nodes: Partial<FlatNode>[]): FlatNode[] {
  return nodes.map((n, index) => ({
    index,
    kind: 'paragraph',
    level: 0,
    text: '',
    styleName: '',
    effectiveStyle: '',
    highlight: null,
    pageStart: null,
    ...n,
  })) as FlatNode[]
}

const H = (level: number, text: string, extra: Partial<FlatNode> = {}): Partial<FlatNode> => ({ kind: 'heading', level, text, ...extra })
const P = (text: string, extra: Partial<FlatNode> = {}): Partial<FlatNode> => ({ kind: 'paragraph', text, ...extra })

// L'inventaire vient du XML (exhaustif) ; seul `byZone` se calcule sur les
// FlatNode. Les comptes ci-dessous sont donc posés à la main, comme le ferait
// buildStyleInventory.
function inventory(styles: Array<[string, number]>, highlights: Array<[string, number, number]> = []): StyleInventory {
  return {
    styles: styles.map(([name, count]) => ({ name, count, headings: 0, sample: '' })),
    highlights: highlights.map(([color, paragraphs, spans]) => ({ color, paragraphs, spans, sample: '' })),
  }
}

// Rejoue le vrai chemin : la ventilation se fait dans buildParsedResult, avec
// la pile qui fait autorité sur la profondeur.
function ventilate(nodes: Partial<FlatNode>[], inv: StyleInventory, corrections?: ImportCorrections) {
  return buildParsedResult(flat(nodes), {}, 0, corrections, inv).result.inventory
}

describe('zoneOfDepth', () => {
  it('regroupe toutes les profondeurs ≥ 2 sous « article »', () => {
    expect(zoneOfDepth(0)).toBe('depth-0')
    expect(zoneOfDepth(1)).toBe('depth-1')
    expect(zoneOfDepth(2)).toBe('depth-2+')
    expect(zoneOfDepth(7)).toBe('depth-2+')
  })
})

describe('ventilateInventory — par le chemin réel (buildParsedResult)', () => {
  it('ventile un style selon la profondeur du nœud où il vit', () => {
    const inv = ventilate(
      [
        H(1, 'Axe', { effectiveStyle: 'Heading 1' }),
        P('intro', { effectiveStyle: 'Paragraphes' }),
        H(2, 'Bloc', { effectiveStyle: 'Heading 2' }),
        P('corps', { effectiveStyle: 'Paragraphes' }),
        H(3, 'Article', { effectiveStyle: 'Heading 3' }),
        P('fond', { effectiveStyle: 'Paragraphes' }),
      ],
      inventory([['Paragraphes', 3], ['Heading 1', 1], ['Heading 2', 1], ['Heading 3', 1]]),
    )

    const byName = (n: string) => inv.styles.find((s) => s.name === n)?.byZone
    // Un style transverse : c'est cette répartition-là qui le dit.
    expect(byName('Paragraphes')).toEqual({ 'depth-0': 1, 'depth-1': 1, 'depth-2+': 1 })
    // Un titre appartient à sa propre profondeur, pas à celle de son parent.
    expect(byName('Heading 1')).toEqual({ 'depth-0': 1 })
    expect(byName('Heading 2')).toEqual({ 'depth-1': 1 })
    expect(byName('Heading 3')).toEqual({ 'depth-2+': 1 })
  })

  it('range le liminaire et le final dans leur zone', () => {
    const inv = ventilate(
      [
        P('Marvarid', { effectiveStyle: 'Title' }),
        P('Pour Margot', { effectiveStyle: 'Dédicace' }),
        H(1, 'Axe', { effectiveStyle: 'Heading 1' }),
        P('corps', { effectiveStyle: 'Paragraphes' }),
        H(1, 'Index', { effectiveStyle: 'Heading 1' }),
        P('entrée', { effectiveStyle: 'Index 1' }),
      ],
      inventory([['Title', 1], ['Dédicace', 1], ['Heading 1', 2], ['Paragraphes', 1], ['Index 1', 1]]),
      { structureStartIndex: 2, structureEndIndex: 4 },
    )

    const byName = (n: string) => inv.styles.find((s) => s.name === n)?.byZone
    expect(byName('Dédicace')).toEqual({ liminaire: 1 })
    expect(byName('Index 1')).toEqual({ final: 1 })
    // Le même style de titre des deux côtés de la borne : une seule ligne dans
    // l'inventaire, deux zones dans sa répartition.
    expect(byName('Heading 1')).toEqual({ 'depth-0': 1, final: 1 })
  })

  it('ventile les styles vivant uniquement dans un tableau ou une liste', () => {
    const inv = ventilate(
      [
        H(1, 'Axe'),
        H(2, 'Bloc'),
        { kind: 'table', tableData: [['a']], innerStyles: ['Voir', 'Voir', 'Table Contents'] },
        { kind: 'list', listItems: [{ text: 'un', depth: 0 }], innerStyles: ['Puces ?'] },
      ],
      inventory([['Voir', 2], ['Table Contents', 1], ['Puces ?', 1]]),
    )

    const byName = (n: string) => inv.styles.find((s) => s.name === n)?.byZone
    // Tableau et liste sont rattachés au nœud ouvert (profondeur 1), pas à la racine.
    expect(byName('Voir')).toEqual({ 'depth-1': 2 })
    expect(byName('Table Contents')).toEqual({ 'depth-1': 1 })
    expect(byName('Puces ?')).toEqual({ 'depth-1': 1 })
  })

  it('ventile les surlignages : paragraphe entier ET spans inline', () => {
    const inv = ventilate(
      [
        H(1, 'Axe'),
        P('à reprendre', { highlight: '#ffff00' }),
        H(2, 'Bloc'),
        P('un <mark data-hl="#ffff00">bout</mark> et <mark data-hl="#00ff00">un autre</mark>'),
      ],
      inventory([], [['#ffff00', 1, 1], ['#00ff00', 0, 1]]),
    )

    const byColor = (c: string) => inv.highlights.find((h) => h.color === c)?.byZone
    expect(byColor('#ffff00')).toEqual({ 'depth-0': 1, 'depth-1': 1 })
    expect(byColor('#00ff00')).toEqual({ 'depth-1': 1 })
  })

  it('un style de l’inventaire absent des FlatNode est ventilé à vide, pas omis', () => {
    // Le cas réel : un paragraphe vide (jamais promu en FlatNode) ou un
    // paragraphe de métadonnées absorbé par buildFlatNodes. L'invariant qui
    // compte : sum(byZone) <= count, jamais l'inverse.
    const inv = ventilate([H(1, 'Axe', { effectiveStyle: 'Heading 1' })], inventory([['Heading 1', 1], ['Auteur', 1]]))

    const auteur = inv.styles.find((s) => s.name === 'Auteur')
    expect(auteur?.count).toBe(1)
    expect(auteur?.byZone).toEqual({})
  })

  it('sum(byZone) <= count pour chaque style', () => {
    const inv = ventilate(
      [H(1, 'Axe', { effectiveStyle: 'Heading 1' }), P('a', { effectiveStyle: 'Paragraphes' })],
      inventory([['Heading 1', 1], ['Paragraphes', 4]]), // 4 : deux vides que les FlatNode ignorent
    )
    for (const style of inv.styles) {
      const sum = Object.values(style.byZone ?? {}).reduce((a, b) => a + b, 0)
      expect(sum).toBeLessThanOrEqual(style.count)
    }
  })
})

describe('ventilateInventory — appelée directement', () => {
  it('ignore un FlatNode sans zone (hors des bornes connues)', () => {
    const inv = ventilateInventory(
      inventory([['Paragraphes', 1]]),
      flat([P('a', { effectiveStyle: 'Paragraphes' })]),
      new Map(), // aucune zone relevée
    )
    expect(inv.styles[0].byZone).toEqual({})
  })

  it("préserve les champs qu'elle ne connaît pas (visuals, page)", () => {
    // La ventilation n'AJOUTE que byZone. Elle reconstruisait un objet littéral
    // { styles, highlights } : le jour où l'inventaire a gagné l'apparence des
    // styles et le format de page, les deux disparaissaient ici en silence,
    // tests au vert. Le passage par le vrai .odt l'a seul révélé.
    const source: StyleInventory = {
      ...inventory([['Paragraphes', 1]]),
      visuals: { Paragraphes: { fontSize: '12pt' } },
      page: { widthCm: 14.801, heightCm: 21.001, marginTopCm: 1, marginBottomCm: 1, marginLeftCm: 2, marginRightCm: 2 },
    }

    const inv = ventilateInventory(source, flat([P('a', { effectiveStyle: 'Paragraphes' })]), new Map())

    expect(inv.visuals).toEqual({ Paragraphes: { fontSize: '12pt' } })
    expect(inv.page?.heightCm).toBe(21.001)
  })
})
