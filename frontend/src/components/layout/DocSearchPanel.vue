<template>
  <!-- Contenu du volet de recherche : bande de stats discrète, onglets, corps
       (nuage de mots). Volontairement SANS fond ni cadre — il est monté tantôt
       dans l'overlay téléporté de la doc-bar, tantôt dans la carte du sommaire
       flottant de la maquette ; l'hôte porte le décor. -->
  <div class="search-panel">
    <div class="search-panel__stats">
      <span
          v-for="item in statItems"
          :key="item.label"
          class="doc-stat"
          :title="item.hint || undefined"
      >
        <b class="doc-stat__value">{{ item.empty ? '—' : item.value }}</b>
        <span class="doc-stat__label">{{ item.label }}</span>
      </span>
    </div>

    <div class="search-panel__tabs" role="tablist">
      <button
          v-for="tab in tabs"
          :key="tab.key"
          class="search-panel__tab"
          :class="{ 'search-panel__tab--active': currentTab === tab.key }"
          role="tab"
          :aria-selected="currentTab === tab.key"
          @click="picked = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.count != null" class="search-panel__count">{{ tab.count }}</span>
      </button>
    </div>

    <div class="search-panel__body">
      <VocabulaireCloud v-if="currentTab === 'nuage'" compact :width="width" />

      <!-- Résultats : chapitres dont le titre approche la saisie (fuzzy). Clic =
           même effet qu'un clic dans l'arbre — l'hôte décide quoi en faire. -->
      <ul v-else-if="currentTab === 'resultats'" class="hits">
        <li v-if="!hits.length" class="hits__empty">Aucun chapitre ne correspond.</li>
        <li v-for="hit in hits" :key="hit.id">
          <button class="hit" @click="$emit('select-node', hit.id)">
            <span class="hit__title">{{ hit.titre }}</span>
            <span v-if="hit.path" class="hit__path">{{ hit.path }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, onMounted, watch } from 'vue'
import FuzzySearch from 'fuzzy-search'
import { formatInt, formatPercent } from '../../script/format'
import VocabulaireCloud from '../analyse/lexical/VocabulaireCloud.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const props = defineProps({
  // Largeur disponible (px) — pilote le nombre de mots par défaut du nuage.
  width: { type: Number, default: 0 },
  // Saisie du champ, portée par l'hôte (la barre ou le sommaire de maquette).
  query: { type: String, default: '' },
})

defineEmits(['select-node'])

// Trame/data injectées plutôt que reçues en props : le panneau est monté par
// deux hôtes différents, tous deux sous DocumentLayout.
const trame = inject('documentTrame', null)
const data = inject('documentData', null)

// ── Recherche floue sur les titres de chapitres ──────────────────────────────
// Index à plat de l'arbre : un nœud = un titre + son chemin (fil d'Ariane des
// ancêtres, pour lever l'ambiguïté entre deux « Introduction »). Seuls les
// TITRES sont indexés : le texte intégral ferait un scan linéaire de plusieurs
// milliers de paragraphes à chaque frappe.
// `fuzzy-search` compare caractère à caractère sans replier les accents : on
// indexe donc une forme normalisée (« éveil » → « eveil ») et on cherche dessus.
const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const index = computed(() => {
  const axes = trame?.value?.axes
  const d = data?.value
  if (!axes || !d) return []
  const out = []
  const walk = (node, ancestors) => {
    const titre = d[node.id]?.titre || '(sans titre)'
    out.push({ id: node.id, titre, norm: fold(titre), path: ancestors.join(' › ') })
    node.children?.forEach((child) => walk(child, [...ancestors, titre]))
  }
  axes.forEach((axe) => walk(axe, []))
  return out
})

// `sort: true` = les meilleurs scores d'abord (sinon ordre du livre).
const searcher = computed(() => new FuzzySearch(index.value, ['norm'], { sort: true }))

const MAX_HITS = 60
const trimmed = computed(() => props.query.trim())
const hits = computed(() =>
  trimmed.value ? searcher.value.search(fold(trimmed.value)).slice(0, MAX_HITS) : [],
)

// Onglets : « Résultats » n'existe QUE pendant une saisie, et prend la main dès
// qu'il apparaît. `picked` retient un choix explicite de l'utilisateur ; il est
// oublié quand l'onglet choisi disparaît (retour au nuage en fin de saisie).
const tabs = computed(() => [
  ...(trimmed.value ? [{ key: 'resultats', label: 'Résultats', count: hits.value.length }] : []),
  { key: 'nuage', label: 'Nuage', count: null },
])
const picked = ref(null)
const currentTab = computed(() =>
  picked.value && tabs.value.some((t) => t.key === picked.value) ? picked.value : tabs.value[0].key,
)
watch(trimmed, (q, prev) => {
  // Début ou fin de saisie : on rend la main au défaut (Résultats / Nuage).
  if (!q || !prev) picked.value = null
})

const { analysis, running, runStep } = useAnalyse()

// Le nuage a besoin du lexical : s'il manque, on le calcule au montage (le
// panneau n'est monté que volet ouvert). Spinner géré par VocabulaireCloud
// tant que `running === 'lexical'`.
onMounted(() => {
  if (!analysis.value?.lexical && !running.value) runStep('lexical')
})

// Stats : structure (caractères/paragraphes/chapitres) dérivée de trame/data,
// global lexical du NLP. Même logique que le bandeau d'AnalyseView, restreinte
// à l'essentiel.
const HINTS = {
  lemmes: 'Formes de base distinctes — un lemme regroupe les flexions d’un mot (chante, chantait → chanter).',
  diversite: 'TTR : mots distincts / mots totaux. Plus c’est élevé, plus le vocabulaire est varié.',
  densite: 'Part des mots porteurs de sens (noms, verbes, adjectifs, adverbes) sur le total.',
}

const structure = computed(() => {
  const axes = trame?.value?.axes
  const d = data?.value
  if (!axes || !d) return null
  let caracteres = 0
  let paragraphes = 0
  let titres = 0
  const walk = (node) => {
    titres++
    paragraphes += d[node.id]?.texte?.length ?? 0
    node.children.forEach(walk)
  }
  for (const axe of axes) {
    caracteres += d[axe.id]?.stats?.caracteres ?? 0
    walk(axe)
  }
  return { caracteres, paragraphes, titres }
})

const statItems = computed(() => {
  const g = analysis.value?.lexical?.global
  const s = structure.value
  const tile = (label, value, hint = null) => ({ label, value, hint, empty: value == null })
  return [
    tile('caractères', s ? formatInt(s.caracteres) : null),
    tile('mots', g ? formatInt(g.words) : null),
    tile('phrases', g ? formatInt(g.sentences) : null),
    tile('paragraphes', s ? formatInt(s.paragraphes) : null),
    tile('chapitres', s ? formatInt(s.titres) : null),
    tile('lemmes', g ? formatInt(g.uniqueLemmas) : null, HINTS.lemmes),
    tile('diversité', g ? formatPercent(g.ttr) : null, HINTS.diversite),
    tile('densité', g ? formatPercent(g.lexicalDensity) : null, HINTS.densite),
  ]
})
</script>

<style scoped>
.search-panel {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* En-tête de stats DISCRÈTE : pas d'aplat coloré, une ligne de chiffres sourds
   qui se replie si la place manque. */
.search-panel__stats {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3em 1.2em;
  padding: 0.4em 0.6em;
  color: var(--c-ink2);
  font-size: var(--fs-xs);
}

.doc-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3em;
}

.doc-stat__value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.doc-stat__label {
  opacity: var(--op-muted);
}

.search-panel__tabs {
  flex: 0 0 auto;
  display: flex;
  gap: 0.4em;
  padding: 0 0.5em;
  margin-bottom: 0.2em;
  border-bottom: 1px solid var(--c-border);
}

.search-panel__tab {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
  padding: 0.4em 0.8em;
  cursor: pointer;
  opacity: var(--op-soft);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.search-panel__tab:hover {
  opacity: 1;
}

/* Onglet actif : accent de barre là où il cascade (overlay de la doc-bar),
   teal sinon (carte du sommaire, hors `.menu`/`.doc-bar`). */
.search-panel__tab--active {
  opacity: 1;
  border-bottom-color: var(--c-bar-accent, var(--c-accent-alt-darker));
}

.search-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

/* Compteur de résultats, collé au libellé de l'onglet. */
.search-panel__count {
  margin-left: 0.4em;
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  opacity: var(--op-muted);
}

/* Liste de résultats : une seule zone défilante (le panneau n'en a pas d'autre
   quand cet onglet est actif). */
.hits {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 0.2em 0.5em;
  list-style: none;
  overflow-y: auto;
}

.hits__empty {
  padding: 0.6em 0.4em;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
  opacity: var(--op-muted);
}

.hit {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.1em;
  padding: 0.35em 0.5em;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.hit:hover {
  background: var(--c-hover);
}

.hit__title {
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hit__path {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  opacity: var(--op-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
