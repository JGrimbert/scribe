import { describe, it, expect } from 'vitest'
import { buildWordIndex, resolveSelection } from './lexicalSelection'
import { buildCloudWords } from './cloudCategories'

const nodesOf = (n) => Array.from({ length: n }, (_, i) => ({ id: `n${i}`, count: 1 }))

describe('buildWordIndex', () => {
  it('indexe les mots du nuage par texte minusculé', () => {
    const words = [
      { text: 'Margot', category: 'personne', count: 220, nodes: [] },
      { text: 'maison', category: 'nom', count: 50, nodes: [] },
    ]
    const index = buildWordIndex(words)
    expect(index.get('margot')).toBe(words[0])
    expect(index.get('maison')).toBe(words[1])
  })

  it('à collision de casse, garde le mot le plus fréquent', () => {
    const index = buildWordIndex([
      { text: 'Pierre', count: 30, nodes: [] },
      { text: 'pierre', count: 10, nodes: [] },
    ])
    expect(index.get('pierre').count).toBe(30)
  })

  it('tolère une liste vide/absente', () => {
    expect(buildWordIndex([]).size).toBe(0)
    expect(buildWordIndex(undefined).size).toBe(0)
  })
})

describe('resolveSelection', () => {
  it('replie sur le lemme cliqué + fallbackCount si absent', () => {
    const index = buildWordIndex([{ text: 'maison', count: 50, nodes: [] }])
    expect(resolveSelection('inconnu', index, 251)).toEqual({ lemma: 'inconnu', count: 251, nodes: [] })
  })

  it('fallbackCount vaut 0 par défaut', () => {
    expect(resolveSelection('inconnu', buildWordIndex([]))).toEqual({ lemma: 'inconnu', count: 0, nodes: [] })
  })

  // Régression bout-en-bout du bug rapporté : le nœud « margot » (minusculé) ne
  // doit PAS renvoyer le lemme brut (« Margot » 279 occ / 164 articles) mais le
  // mot du nuage, c.-à-d. l'ENTITÉ nommée (220 occ / 136 articles). Aucun
  // différentiel avec ce qu'affiche VocabulaireCloud.
  it('apparie un nœud à l’entité du nuage, sans différentiel (cas Margot)', () => {
    const lemmas = [{ lemma: 'Margot', pos: 'PROPN', count: 279, nodes: nodesOf(164) }]
    const entities = [
      { text: 'Margot', label: 'PER', count: 220, nodes: nodesOf(136) },
      { text: 'ma Margot', label: 'PER', count: 4, nodes: [] }, // span multi-mots : ignoré
      { text: 'Margot', label: 'LOC', count: 6, nodes: nodesOf(3) },
    ]
    const index = buildWordIndex(buildCloudWords(lemmas, entities))
    const sel = resolveSelection('margot', index, 251)
    expect(sel.lemma).toBe('Margot')
    expect(sel.count).toBe(220)
    expect(sel.nodes).toHaveLength(136)
  })

  it('résout un nom commun via son lemme (casse identique)', () => {
    const lemmas = [{ lemma: 'maison', pos: 'NOUN', count: 50, nodes: nodesOf(20) }]
    const index = buildWordIndex(buildCloudWords(lemmas, []))
    const sel = resolveSelection('maison', index)
    expect(sel).toEqual({ lemma: 'maison', count: 50, nodes: nodesOf(20) })
  })
})
