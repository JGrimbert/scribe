import { describe, it, expect } from 'vitest'
import {
  absorbableCount,
  clampShift,
  extendedLiminaire,
  nextNodeTitle,
  nodeToEntries,
  nodesInOrder,
} from './liminaire-bornes'

// Un arbre à deux niveaux : l'axe « A » porte deux enfants, puis l'axe « B ».
const axes = [
  { id: 'a', children: [{ id: 'a1', children: [] }, { id: 'a2', children: [] }] },
  { id: 'b', children: [] },
]

const data = {
  a: { id: 'a', titre: 'A', texte: [{ type: 'paragraph', text: 'corps de A' }] },
  a1: { id: 'a1', titre: 'A1', texte: [] },
  a2: { id: 'a2', titre: 'A2', texte: [{ type: 'paragraph', text: 'corps de A2' }] },
  b: { id: 'b', titre: 'B', texte: [] },
}

const liminaire = [{ type: 'paragraph', text: 'Faux-titre', styleName: 'Title' }]

describe('nodesInOrder', () => {
  it("suit l'ordre du document (préfixe), pas l'ordre des axes racines", () => {
    expect(nodesInOrder(axes, data).map((n) => n.titre)).toEqual(['A', 'A1', 'A2', 'B'])
  })

  it('ignore un nœud sans contenu dans data plutôt que de pousser un trou', () => {
    expect(nodesInOrder([{ id: 'fantome', children: [] }], data)).toEqual([])
  })

  it('ne casse pas sur un arbre vide', () => {
    expect(nodesInOrder(undefined, undefined)).toEqual([])
  })
})

describe('nodeToEntries', () => {
  it('rend le titre en entrée ouvrant une page, puis le texte propre', () => {
    expect(nodeToEntries(data.a)).toEqual([
      { type: 'paragraph', text: 'A', styleName: 'Titre absorbé', pageStart: 'page' },
      { type: 'paragraph', text: 'corps de A' },
    ])
  })

  it('omet le titre quand il est vide — pas d’entrée fantôme', () => {
    expect(nodeToEntries({ titre: '  ', texte: [{ type: 'paragraph', text: 'x' }] })).toEqual([
      { type: 'paragraph', text: 'x' },
    ])
  })

  it('donne au titre un styleName NEUTRE : un nom reconnu poserait une frontière de type', () => {
    // « Dédicace » comme styleName scinderait la page (cf. typeOfStyleName).
    expect(nodeToEntries({ titre: 'Dédicace', texte: [] })[0].styleName).toBe('Titre absorbé')
  })
})

describe('extendedLiminaire', () => {
  it('rend le liminaire intact à décalage nul', () => {
    expect(extendedLiminaire(liminaire, axes, data, 0)).toEqual(liminaire)
  })

  it('absorbe les nœuds dans l’ordre, en conservant les entrées d’origine en tête', () => {
    const out = extendedLiminaire(liminaire, axes, data, 2)
    expect(out.map((e) => e.text)).toEqual(['Faux-titre', 'A', 'corps de A', 'A1'])
  })

  it('sature au nombre de nœuds disponibles plutôt que de déborder', () => {
    const out = extendedLiminaire(liminaire, axes, data, 99)
    expect(out.map((e) => e.text)).toEqual(['Faux-titre', 'A', 'corps de A', 'A1', 'A2', 'corps de A2', 'B'])
  })

  it('ignore un décalage négatif — on ne peut pas mordre sur le liminaire d’origine', () => {
    expect(extendedLiminaire(liminaire, axes, data, -3)).toEqual(liminaire)
  })
})

describe('clampShift / absorbableCount / nextNodeTitle', () => {
  it('borne le décalage entre 0 et le nombre de nœuds', () => {
    expect(absorbableCount(axes, data)).toBe(4)
    expect(clampShift(-1, axes, data)).toBe(0)
    expect(clampShift(9, axes, data)).toBe(4)
  })

  it('annonce le prochain nœud à absorber, et rien quand tout est absorbé', () => {
    expect(nextNodeTitle(axes, data, 0)).toBe('A')
    expect(nextNodeTitle(axes, data, 2)).toBe('A2')
    expect(nextNodeTitle(axes, data, 4)).toBeNull()
  })

  it('nomme un nœud sans titre plutôt que de rendre une chaîne vide', () => {
    expect(nextNodeTitle([{ id: 'x', children: [] }], { x: { titre: '', texte: [] } }, 0)).toBe('Sans titre')
  })
})
