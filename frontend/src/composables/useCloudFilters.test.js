import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useCloudFilters } from './useCloudFilters'

// Fixture minimal (noms anonymisés) : un mot commun par nature + un nom présent
// dans les lemmes (Alice) + un nom ABSENT des lemmes mais reconnu en entité
// (Bruno) + un mot commun capté par erreur comme entité (« Coeur »).
const lexical = ref({
  global: { posCounts: { NOUN: 100, VERB: 200, ADJ: 50, ADV: 30, PROPN: 40 } },
  lemmas: [
    { lemma: 'pouvoir', pos: 'VERB', count: 200, nodes: [] },
    { lemma: 'coeur', pos: 'NOUN', count: 80, nodes: [] },
    { lemma: 'grand', pos: 'ADJ', count: 50, nodes: [] },
    { lemma: 'souvent', pos: 'ADV', count: 30, nodes: [] },
    { lemma: 'Alice', pos: 'PROPN', count: 190, nodes: [] },
  ],
  entities: [
    { text: 'Alice', label: 'PER', count: 180, nodes: [] },
    { text: 'Bruno', label: 'PER', count: 23, nodes: [] },
    { text: 'Lyon', label: 'LOC', count: 30, nodes: [] },
    { text: 'Coeur', label: 'PER', count: 3, nodes: [] },
  ],
})

describe('useCloudFilters', () => {
  const f = useCloudFilters(lexical)

  // Garde-fou principal : c'est l'API que VocabulaireCard déstructure. Si le
  // composable ne l'expose pas, `filteredWords.value` plante au setup et le
  // nuage ne s'affiche jamais (régression vécue).
  it('expose bien words et filteredWords, peuplés', () => {
    expect(f.words).toBeDefined()
    expect(f.filteredWords).toBeDefined()
    expect(f.words.value.length).toBeGreaterThan(0)
    expect(f.filteredWords.value.length).toBeGreaterThan(0)
  })

  it('expose le reste de l’API consommée par la vue', () => {
    for (const key of ['active', 'POS_FILTERS', 'ENTITY_FILTERS', 'filterStats', 'statLabel']) {
      expect(f[key]).toBeDefined()
    }
  })

  it('fait apparaître un nom absent des lemmes (via les entités)', () => {
    expect(f.words.value.some((w) => w.text === 'Bruno' && w.category === 'personne')).toBe(true)
  })

  it('retire une catégorie décochée de filteredWords', () => {
    f.active.verbe = false
    expect(f.filteredWords.value.some((w) => w.category === 'verbe')).toBe(false)
    f.active.verbe = true
    expect(f.filteredWords.value.some((w) => w.category === 'verbe')).toBe(true)
  })

  it('calcule des stats non nulles par catégorie', () => {
    expect(f.filterStats.value.personne.distinct).toBeGreaterThan(0)
    expect(f.filterStats.value.nom.distinct).toBeGreaterThan(0)
  })
})
