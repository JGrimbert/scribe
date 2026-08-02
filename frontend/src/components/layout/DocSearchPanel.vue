<template>
  <!-- Contenu du volet de recherche : bande de stats discrète, onglets, corps
       (nuage de mots). Volontairement SANS fond ni cadre — il est monté tantôt
       dans l'overlay téléporté de la doc-bar, tantôt dans la carte du sommaire
       flottant de la maquette ; l'hôte porte le décor. -->
  <div class="search-panel">
    <DocStats :items="statItems" />

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
import { computed, ref, watch } from 'vue'
import DocStats from './DocStats.vue'
import VocabulaireCloud from '../analyse/lexical/VocabulaireCloud.vue'
import { useDocStats } from '../../composables/useDocStats'
import { useDocSearch } from '../../composables/useDocSearch'

const props = defineProps({
  // Largeur disponible (px) — pilote le nombre de mots par défaut du nuage.
  width: { type: Number, default: 0 },
  // Saisie du champ, portée par l'hôte (la barre ou le sommaire de maquette).
  query: { type: String, default: '' },
})

defineEmits(['select-node'])

// Recherche floue (titres de chapitres) : mutualisée avec le module de résultats
// de la maquette, qui en tire des fragments de texte.
const { trimmed, hits } = useDocSearch(() => props.query)

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

// Stats + amorçage de l'étape lexicale : mutualisés avec le dock de la maquette.
const { statItems } = useDocStats()
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
