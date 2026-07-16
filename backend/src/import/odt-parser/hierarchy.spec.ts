import { describe, it, expect } from 'vitest'
import { buildParsedResult } from './hierarchy'
import { FlatNode, ImportCorrections } from './types'

// Assigne l'index positionnel à chaque nœud (structureStartIndex/levelOverrides
// sont exprimés par index de FlatNode, donc l'ordre = l'index).
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

const H = (level: number, text: string, extra: Partial<FlatNode> = {}): Partial<FlatNode> => ({ kind: 'heading', level, text, ...extra })
const P = (text: string, extra: Partial<FlatNode> = {}): Partial<FlatNode> => ({ kind: 'paragraph', text, ...extra })

function build(nodes: Partial<FlatNode>[], corrections?: ImportCorrections) {
  return buildParsedResult(flat(nodes), {}, 0, corrections).result
}

describe('buildParsedResult — hiérarchie', () => {
  it('imbrique selon les niveaux et compte par profondeur', () => {
    const result = build([H(1, 'Axe'), P('intro'), H(2, 'Bloc'), H(3, 'Article'), P('corps')])

    expect(result.axes).toHaveLength(1)
    expect(result.axes[0].titre).toBe('Axe')
    expect(result.axes[0].children[0].titre).toBe('Bloc')
    expect(result.axes[0].children[0].children[0].titre).toBe('Article')
    expect(result.meta).toMatchObject({ totalAxes: 1, totalBlocs: 1, totalArticles: 1, maxDepth: 2, totalNodes: 5 })
  })

  it('imbrique un saut de niveau (1 → 3) sans créer de nœud fantôme', () => {
    const result = build([H(1, 'Axe'), H(3, 'Sous')])

    // 'Sous' devient enfant direct de 'Axe' → profondeur réelle 1, pas 2.
    expect(result.axes[0].children).toHaveLength(1)
    expect(result.axes[0].children[0].titre).toBe('Sous')
    expect(result.meta).toMatchObject({ totalBlocs: 1, totalArticles: 0, maxDepth: 1 })
  })

  it('ferme les bons ancêtres quand un niveau supérieur réapparaît', () => {
    const result = build([H(1, 'Axe 1'), H(2, 'Bloc 1'), H(1, 'Axe 2')])
    expect(result.axes.map((a) => a.titre)).toEqual(['Axe 1', 'Axe 2'])
    expect(result.axes[0].children[0].titre).toBe('Bloc 1')
    expect(result.axes[1].children).toHaveLength(0)
  })
})

describe('buildParsedResult — corrections utilisateur', () => {
  it('applique levelOverrides pour remonter un titre mal détecté', () => {
    // 'B' détecté en niveau 2 mais corrigé en niveau 1 → devient un axe frère.
    const result = build([H(1, 'A'), H(2, 'B')], { structureStartIndex: 0, levelOverrides: { 1: 1 } })
    expect(result.axes.map((a) => a.titre)).toEqual(['A', 'B'])
    expect(result.meta.totalAxes).toBe(2)
  })

  it('override niveau 0 rétrograde un titre en simple paragraphe du nœud courant', () => {
    const result = build([H(1, 'A'), H(2, 'B')], { structureStartIndex: 0, levelOverrides: { 1: 0 } })
    expect(result.axes).toHaveLength(1)
    expect(result.axes[0].children).toHaveLength(0)
    expect(result.axes[0].texte).toEqual([{ type: 'paragraph', text: 'B' }])
    expect(result.meta.titresVides).toBe(0)
  })

  it('envoie en liminaire tout ce qui précède structureStartIndex', () => {
    const result = build([P('page de titre'), P('auteur'), H(1, 'Vrai début'), P('corps')], {
      structureStartIndex: 2,
    })
    expect(result.liminaire).toEqual([
      { type: 'paragraph', text: 'page de titre' },
      { type: 'paragraph', text: 'auteur' },
    ])
    expect(result.meta.paragraphesLiminaire).toBe(2)
    expect(result.axes).toHaveLength(1)
    expect(result.axes[0].titre).toBe('Vrai début')
    expect(result.axes[0].texte).toEqual([{ type: 'paragraph', text: 'corps' }])
  })

  // Ce que l'ancien `preambule: string[]` perdait, et toute la raison du
  // changement : sans styleName ni highlight, la typologie n'a rien à dire de
  // ces zones.
  it('le liminaire porte styleName et highlight', () => {
    const result = build(
      [P('Marvarid', { effectiveStyle: 'Titre principal' }), P('à reprendre', { highlight: '#ffff00' }), H(1, 'Début')],
      { structureStartIndex: 2 },
    )
    expect(result.liminaire).toEqual([
      { type: 'paragraph', text: 'Marvarid', styleName: 'Titre principal' },
      { type: 'paragraph', text: 'à reprendre', highlight: '#ffff00' },
    ])
  })

  it('envoie en final tout ce qui suit structureEndIndex, titres compris', () => {
    const result = build([H(1, 'Axe'), P('corps'), H(1, 'Index'), P('entrée', { effectiveStyle: 'Index 1' })], {
      structureStartIndex: 0,
      structureEndIndex: 2,
    })
    expect(result.final).toEqual([
      { type: 'paragraph', text: 'Index' },
      { type: 'paragraph', text: 'entrée', styleName: 'Index 1' },
    ])
    expect(result.meta.paragraphesFinal).toBe(2)
    // Le titre de la partie finale ne devient pas un axe.
    expect(result.axes.map((a) => a.titre)).toEqual(['Axe'])
  })

  it('sans structureEndIndex, le corps va jusqu’au bout', () => {
    const result = build([H(1, 'Axe'), P('corps'), H(1, 'Index')], { structureStartIndex: 0 })
    expect(result.final).toEqual([])
    expect(result.meta.paragraphesFinal).toBe(0)
    expect(result.axes).toHaveLength(2)
  })
})

describe('buildParsedResult — style d’une liste', () => {
  it('retient le style des ITEMS, pas celui du <text:list>', () => {
    // « L1 » est un style de liste : absent de l'inventaire (qui ne compte que
    // p/h), donc impossible à typologiser, et il ressortirait en trou dans les
    // signatures de structure. Le style qui a un sens est celui des items.
    const result = build([
      H(1, 'Axe'),
      { kind: 'list', effectiveStyle: 'L1', listItems: [{ text: 'un', depth: 0 }], innerStyles: ['Puces ?'] },
    ])
    expect(result.axes[0].texte[0]).toMatchObject({ type: 'list', styleName: 'Puces ?' })
  })

  it('n’invente pas de style quand les items n’en portent pas', () => {
    const result = build([H(1, 'Axe'), { kind: 'list', effectiveStyle: 'L1', listItems: [{ text: 'un', depth: 0 }] }])
    expect(result.axes[0].texte[0]).not.toHaveProperty('styleName')
  })
})

describe('buildParsedResult — contenu, slugs, stats, index', () => {
  it('compte les titres vides', () => {
    const result = build([H(1, '')])
    expect(result.meta.titresVides).toBe(1)
    expect(result.axes[0].titre).toBe('')
  })

  it('agrège les stats depuis le texte propre + descendants (titre exclu)', () => {
    const result = build([H(1, 'Axe'), P('un deux trois')])
    expect(result.axes[0].stats).toMatchObject({ mots: 3, status: 'ébauche' })
  })

  it('déduplique les slugs par parent, indépendamment entre parents', () => {
    const result = build([H(1, 'A'), H(2, 'Bloc'), H(2, 'Bloc'), H(1, 'B'), H(2, 'Bloc')])
    expect(result.axes[0].children.map((c) => c.slug)).toEqual(['bloc', 'bloc-2'])
    expect(result.axes[1].children.map((c) => c.slug)).toEqual(['bloc']) // set de slugs distinct par parent
  })

  it('assigne indexGlobal aux seules feuilles, dans l’ordre', () => {
    const result = build([H(1, 'A'), H(2, 'B'), H(1, 'C')])
    expect(result.axes[0].indexGlobal).toBeNull() // a des enfants
    expect(result.axes[0].children[0].indexGlobal).toBe(1) // B, feuille
    expect(result.axes[1].indexGlobal).toBe(2) // C, feuille
  })

  it('rattache tableau et liste au nœud courant', () => {
    const result = build([
      H(1, 'A'),
      { index: 0, kind: 'table', tableData: [['x', 'y']] },
      { index: 0, kind: 'list', listItems: [{ text: 'item', depth: 0 }], listOrdered: true },
    ])
    expect(result.axes[0].tableau).toEqual([['x', 'y']])
    expect(result.axes[0].texte).toEqual([{ type: 'list', ordered: true, items: [{ text: 'item', depth: 0 }] }])
  })

  it('classe citations et pistes selon le style effectif, le surlignage ou la ponctuation', () => {
    const result = build([
      H(1, 'A'),
      P('« une citation »'),
      // Une piste vient d'un VRAI surlignage (fo:background-color résolu en
      // amont), plus d'un nom de style qui contiendrait « surlign » : « P26 »
      // ne dit rien, et l'ancienne heuristique n'était pas corrigeable.
      P('surligné', { highlight: '#ffff00' }),
    ])
    expect(result.axes[0].citations).toEqual(['« une citation »'])
    expect(result.axes[0].pistes).toEqual(['surligné'])
    // Les deux restent aussi dans le flux texte.
    expect(result.axes[0].texte).toHaveLength(2)
  })

  it('fait voyager style effectif et surlignage jusque dans texte[]', () => {
    const result = build([
      H(1, 'A'),
      P('Un corps.', { effectiveStyle: 'Paragraphes' }),
      P('Annoté.', { effectiveStyle: 'Paragraphes', highlight: '#ffff00' }),
    ])
    expect(result.axes[0].texte).toEqual([
      { type: 'paragraph', text: 'Un corps.', styleName: 'Paragraphes' },
      { type: 'paragraph', text: 'Annoté.', styleName: 'Paragraphes', highlight: '#ffff00' },
    ])
  })

  it('ne compte pas les marqueurs comme des mots dans les stats', () => {
    // Régression : entryPlainText rendait le texte AVEC ses balises, si bien
    // que computeStats comptait « <mark », « data-hl="#ffff00"> » et
    // « </mark> ». Sur le manuscrit témoin, ça gonflait le total du livre de
    // ~175 mots.
    const nu = build([H(1, 'A'), P('un deux trois quatre cinq')])
    const balise = build([
      H(1, 'A'),
      P('un deux <mark data-hl="#ffff00">trois</mark> <a data-bookmark="sig">quatre</a> cinq'),
    ])
    expect(nu.axes[0].stats!.mots).toBe(5)
    expect(balise.axes[0].stats!.mots).toBe(5)
    expect(balise.axes[0].stats!.caracteres).toBe(nu.axes[0].stats!.caracteres)
  })

  it('n’alourdit pas une entrée sans style ni surlignage', () => {
    const result = build([H(1, 'A'), P('Nu.')])
    expect(result.axes[0].texte).toEqual([{ type: 'paragraph', text: 'Nu.' }])
  })

  it('propage la meta (auteur/titreLivre) dans result.meta', () => {
    const result = buildParsedResult(flat([H(1, 'A')]), { auteur: 'Jean', titreLivre: 'Livre' }, 3).result
    expect(result.meta).toMatchObject({ auteur: 'Jean', titreLivre: 'Livre', sectionsRencontrees: 3 })
  })
})
