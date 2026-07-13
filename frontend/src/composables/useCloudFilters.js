import { computed, reactive } from 'vue'
import { formatInt } from '../script/format'

// Deux familles de filtres, sur deux lignes distinctes : natures grammaticales
// (issues des POS) puis entités nommées (Personnes/Lieux, source NER). Les noms
// propres (PROPN) ne sont plus un filtre à part : chacun est reclassé en
// « personne » ou « lieu » via les entités, un propre non typé retombant sur
// « personne » (cf. categoryOf).
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

// Catégorie ↔ POS (bijection pour les natures grammaticales).
const POS_TO_KEY = { NOUN: 'nom', ADJ: 'adj', VERB: 'verbe', ADV: 'adverbe' }
const KEY_TO_POS = { nom: 'NOUN', adj: 'ADJ', verbe: 'VERB', adverbe: 'ADV' }

// Reclassement des noms propres selon le type d'entité.
const ENTITY_LABEL_TO_KEY = { PER: 'personne', LOC: 'lieu' }
const ENTITY_KEY_TO_LABEL = { personne: 'PER', lieu: 'LOC' }
const ENTITY_PRIORITY = { personne: 0, lieu: 1 }

// Filtres du nuage + statistiques par catégorie. `lexical` est le volet lexical
// réactif (lemmes + entités + posCounts).
export function useCloudFilters(lexical) {
  // Adverbes décochés par défaut : souvent peu porteurs de sens.
  const active = reactive({ nom: true, personne: true, lieu: true, adj: true, verbe: true, adverbe: false })

  const lemmas = computed(() => lexical.value?.lemmas ?? null)
  const posCounts = computed(() => lexical.value?.global?.posCounts ?? {})
  // Dénominateur du pourcentage : tokens hors ponctuation/espaces (comme posCounts).
  const totalTokens = computed(() => Object.values(posCounts.value).reduce((sum, c) => sum + c, 0) || 1)

  // Index token(minuscule) → catégorie ('personne'|'lieu'), issu des entités NER.
  // Un token présent dans plusieurs types garde le plus prioritaire (PER > LOC) —
  // résout les ambigus (« Katia » présente en PER et MISC).
  const entityIndex = computed(() => {
    const idx = new Map()
    for (const entity of lexical.value?.entities ?? []) {
      const key = ENTITY_LABEL_TO_KEY[entity.label]
      if (!key) continue
      for (const token of entity.text.toLowerCase().split(/\s+/)) {
        if (!token) continue
        const prev = idx.get(token)
        if (prev === undefined || ENTITY_PRIORITY[key] < ENTITY_PRIORITY[prev]) idx.set(token, key)
      }
    }
    return idx
  })

  // Catégorie d'un lemme : POS directe, sauf les noms propres reclassés via les
  // entités (PER→personne, LOC→lieu ; sinon personne).
  function categoryOf(lemma) {
    if (lemma.pos !== 'PROPN') return POS_TO_KEY[lemma.pos]
    return entityIndex.value.get(lemma.lemma.toLowerCase()) ?? 'personne'
  }

  // Nombre de lemmes distincts par catégorie, compté sur la liste de lemmes (300
  // max, hors stopwords) — toujours disponible, contrairement à `distinctByPos`
  // (absent des analyses antérieures à son introduction).
  const distinctByCategory = computed(() => {
    const acc = {}
    for (const lemma of lemmas.value ?? []) {
      const key = categoryOf(lemma)
      acc[key] = (acc[key] ?? 0) + 1
    }
    return acc
  })

  function pct(occ) {
    return ((occ / totalTokens.value) * 100).toFixed(1).replace('.', ',')
  }

  // Distinct = lemmes de la catégorie dans le nuage ; occurrences (donc %) depuis
  // les sources complètes : posCounts pour les natures grammaticales, entités NER
  // (PER/LOC) pour Personnes/Lieux.
  function statFor(key) {
    const distinct = distinctByCategory.value[key] ?? 0
    const label = ENTITY_KEY_TO_LABEL[key]
    if (label) {
      let occ = 0
      for (const e of lexical.value?.entities ?? []) if (e.label === label) occ += e.count
      return { distinct, occ, percent: pct(occ) }
    }
    const occ = posCounts.value[KEY_TO_POS[key]] ?? 0
    return { distinct, occ, percent: pct(occ) }
  }

  const filterStats = computed(() =>
    Object.fromEntries(ALL_FILTERS.map((f) => [f.key, statFor(f.key)])),
  )

  // Items distincts de la catégorie · part de ses OCCURRENCES dans le texte.
  function statLabel(s) {
    return `${formatInt(s.distinct)} · ${s.percent} %`
  }

  // Lemmes passant les filtres actifs (déjà triés par fréquence côté backend) —
  // non tronqués : le nombre de mots affichés est appliqué par le consommateur.
  const filteredLemmas = computed(() =>
    (lemmas.value ?? []).filter((lemma) => active[categoryOf(lemma)]),
  )

  return { active, POS_FILTERS, ENTITY_FILTERS, filterStats, statLabel, filteredLemmas }
}
