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
          v-for="tab in PANEL_TABS"
          :key="tab.key"
          class="search-panel__tab"
          :class="{ 'search-panel__tab--active': activeTab === tab.key }"
          role="tab"
          :aria-selected="activeTab === tab.key"
          @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="search-panel__body">
      <VocabulaireCloud v-if="activeTab === 'nuage'" compact :width="width" />
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, onMounted } from 'vue'
import { formatInt, formatPercent } from '../../script/format'
import VocabulaireCloud from '../analyse/lexical/VocabulaireCloud.vue'
import { useAnalyse } from '../../composables/useAnalyse'

defineProps({
  // Largeur disponible (px) — pilote le nombre de mots par défaut du nuage.
  width: { type: Number, default: 0 },
})

const activeTab = ref('nuage')
const PANEL_TABS = [{ key: 'nuage', label: 'Nuage' }]

// Trame/data injectées plutôt que reçues en props : le panneau est monté par
// deux hôtes différents, tous deux sous DocumentLayout.
const trame = inject('documentTrame', null)
const data = inject('documentData', null)

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
</style>
