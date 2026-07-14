import { describe, it, expect } from 'vitest'
import { buildCloudWords } from './cloudCategories'

// Fixture anonymisé, calqué sur les cas rencontrés sur un vrai manuscrit :
//  - Alice : nom PRÉSENT dans les lemmes (PROPN fréquent) et reconnu PER.
//  - Bruno : nom ABSENT des lemmes (peu fréquent → hors du top des lemmes) mais
//    reconnu PER — c'est LE cas que l'ancienne approche (lemmes seuls) perdait.
//  - Lyon : lieu présent, reconnu LOC.
//  - « coeur » : mot commun fréquent, capté 3 fois par erreur comme entité PER
//    (« Coeur » en début de phrase) → doit RESTER un nom commun (ratio faible).
//  - « la Alice » : span multi-mots → ignoré (variante, pas un mot du nuage).
//  - « I » : initiale (1 lettre) → ignorée.
const lemmas = [
  { lemma: 'pouvoir', pos: 'VERB', count: 400, nodes: [{ nodeId: 'v', titre: 'V', count: 400 }] },
  { lemma: 'coeur', pos: 'NOUN', count: 80, nodes: [{ nodeId: 'c', titre: 'C', count: 80 }] },
  { lemma: 'grand', pos: 'ADJ', count: 60, nodes: [{ nodeId: 'g', titre: 'G', count: 60 }] },
  { lemma: 'Alice', pos: 'PROPN', count: 210, nodes: [{ nodeId: 'a', titre: 'A', count: 210 }] },
  { lemma: 'souvent', pos: 'ADV', count: 40, nodes: [{ nodeId: 's', titre: 'S', count: 40 }] },
]

const entities = [
  { text: 'Alice', label: 'PER', count: 190, nodes: [{ nodeId: 'a', titre: 'A', count: 190 }] },
  { text: 'Bruno', label: 'PER', count: 23, nodes: [{ nodeId: 'b', titre: 'B', count: 23 }] },
  { text: 'Lyon', label: 'LOC', count: 30, nodes: [{ nodeId: 'l', titre: 'L', count: 30 }] },
  { text: 'Coeur', label: 'PER', count: 3, nodes: [{ nodeId: 'x', titre: 'X', count: 3 }] },
  { text: 'la Alice', label: 'PER', count: 4, nodes: [] },
  { text: 'I', label: 'PER', count: 5, nodes: [] },
]

function byText(words) {
  return new Map(words.map((w) => [w.text, w]))
}

describe('buildCloudWords', () => {
  const words = buildCloudWords(lemmas, entities)
  const idx = byText(words)

  it('classe en personne un nom présent dans les lemmes (via NER, pas via POS)', () => {
    expect(idx.get('Alice')?.category).toBe('personne')
    // Le lemme PROPN « Alice » n'est pas redoublé : une seule entrée « Alice ».
    expect(words.filter((w) => w.text === 'Alice')).toHaveLength(1)
  })

  it('fait apparaître un nom ABSENT des lemmes (régression corrigée)', () => {
    const bruno = idx.get('Bruno')
    expect(bruno).toBeTruthy()
    expect(bruno.category).toBe('personne')
    // Il porte bien ses nodes (occurrences par article) pour OccurrencesCard.
    expect(bruno.nodes).toHaveLength(1)
  })

  it('classe un lieu depuis les entités LOC', () => {
    expect(idx.get('Lyon')?.category).toBe('lieu')
  })

  it('garde en nom commun un mot capté par erreur comme entité (ratio faible)', () => {
    // « Coeur » entité (3) ≪ « coeur » lemme (80) → reste un nom, pas une personne.
    expect(idx.get('coeur')?.category).toBe('nom')
    expect(idx.get('Coeur')).toBeUndefined()
  })

  it('ignore les entités multi-mots et les initiales', () => {
    expect(idx.get('la Alice')).toBeUndefined()
    expect(idx.get('I')).toBeUndefined()
  })

  it('catégorise les mots communs par nature grammaticale', () => {
    expect(idx.get('pouvoir')?.category).toBe('verbe')
    expect(idx.get('grand')?.category).toBe('adj')
    expect(idx.get('souvent')?.category).toBe('adverbe')
  })

  it('trie par occurrence décroissante', () => {
    const counts = words.map((w) => w.count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })
})
