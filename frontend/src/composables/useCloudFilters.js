import { computed, reactive } from 'vue'
import { formatInt } from '../script/format'
import { buildCloudWords } from '../script/cloudCategories'

// Deux familles de filtres, sur deux lignes distinctes : natures grammaticales
// (issues des POS) puis entités nommées (Personnes/Lieux, source NER).
const POS_FILTERS = [
  { key: 'nom', label: 'Noms' },
  { key: 'adj', label: 'Adjectifs' },
  { key: 'verbe', label: 'Verbes' },
  { key: 'adverbe', label: 'Adverbes' },
]
const ENTITY_FILTERS = [
  { key: 'personne', label: 'Personnes' },
  { key: 'lieu', label: 'Lieux' },
]
const ALL_FILTERS = [...POS_FILTERS, ...ENTITY_FILTERS]

// Catégorie grammaticale → POS (dénominateur d'occurrences des chips).
const KEY_TO_POS = { nom: 'NOUN', adj: 'ADJ', verbe: 'VERB', adverbe: 'ADV' }
const ENTITY_KEYS = new Set(['personne', 'lieu'])

// Filtres du nuage + statistiques par catégorie. `lexical` est le volet lexical
// réactif (lemmes + entités + posCounts). Expose `words` (tous les mots du nuage)
// et `filteredWords` (ceux passant les filtres actifs) — c'est cette API que
// consomme VocabulaireCloud.
export function useCloudFilters(lexical) {
  // Adverbes décochés par défaut : souvent peu porteurs de sens.
  const active = reactive({ nom: true, personne: true, lieu: true, adj: true, verbe: true, adverbe: false })

  const posCounts = computed(() => lexical.value?.global?.posCounts ?? {})
  // Dénominateur du pourcentage : tokens hors ponctuation/espaces (comme posCounts).
  const totalTokens = computed(() => Object.values(posCounts.value).reduce((sum, c) => sum + c, 0) || 1)

  // Tous les mots du nuage (mots communs depuis les lemmes, personnes/lieux
  // depuis les entités), triés par occurrence — cf. cloudCategories.
  const words = computed(() => buildCloudWords(lexical.value?.lemmas, lexical.value?.entities))
  const filteredWords = computed(() => words.value.filter((w) => active[w.category]))

  // Distinct + occurrences par catégorie, en un passage.
  const byCategory = computed(() => {
    const acc = {}
    for (const w of words.value) {
      const c = acc[w.category] ?? (acc[w.category] = { distinct: 0, occ: 0 })
      c.distinct += 1
      c.occ += w.count
    }
    return acc
  })

  function pct(occ) {
    return ((occ / totalTokens.value) * 100).toFixed(1).replace('.', ',')
  }

  // Distinct = mots de la catégorie dans le nuage. Occurrences (donc %) : pour
  // les natures grammaticales, posCounts (source complète — les lemmes sont
  // plafonnés) ; pour personne/lieu, la somme des comptes des noms retenus.
  function statFor(key) {
    const cat = byCategory.value[key] ?? { distinct: 0, occ: 0 }
    const occ = ENTITY_KEYS.has(key) ? cat.occ : posCounts.value[KEY_TO_POS[key]] ?? 0
    return { distinct: cat.distinct, occ, percent: pct(occ) }
  }

  const filterStats = computed(() => Object.fromEntries(ALL_FILTERS.map((f) => [f.key, statFor(f.key)])))

  // Items distincts de la catégorie · part de ses OCCURRENCES dans le texte.
  function statLabel(s) {
    return `${formatInt(s.distinct)} · ${s.percent} %`
  }

  return { active, POS_FILTERS, ENTITY_FILTERS, filterStats, statLabel, words, filteredWords }
}
