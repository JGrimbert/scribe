<template>
  <div class="config-view">
    <header class="config-header">
      <h2>Configuration</h2>
      <UiNote variant="hint">
        Deux volets, dans cet ordre parce que la dépendance va dans ce sens : les bornes et les
        niveaux de titres décident des zones, les zones décident de la répartition des styles, et
        c'est elle qui range le tableau des rôles. Rien ne remonte de la droite vers la gauche.
      </UiNote>
    </header>

    <!-- Onglets numérotés, pas juxtaposés : l'ordre est une dépendance, pas une
         préférence d'affichage. -->
    <div class="volets" role="tablist">
      <button
          v-for="(v, i) in VOLETS"
          :key="v.key"
          class="volet"
          :class="{ 'volet--active': volet === v.key }"
          type="button"
          role="tab"
          :aria-selected="volet === v.key"
          @click="volet = v.key"
      >
        <span class="volet__num">{{ i + 1 }}</span>
        {{ v.label }}
      </button>
    </div>

    <StructureConfig v-if="volet === 'structure'" />
    <StylesView v-else />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiNote from './ui/UiNote.vue'
import StructureConfig from './StructureConfig.vue'
import StylesView from './StylesView.vue'

const route = useRoute()
const router = useRouter()

const VOLETS = [
  { key: 'structure', label: 'Structure du livre' },
  { key: 'styles', label: 'Styles & règles' },
]

// Dans l'URL plutôt qu'en ref locale : l'ancien `/documents/:id/styles` y
// redirige (`?volet=styles`), et un renvoi vers « la typologie » doit pouvoir
// viser le bon volet. `replace` — changer de volet n'est pas un pas de
// navigation à empiler dans l'historique.
const volet = computed({
  get: () => (route.query.volet === 'styles' ? 'styles' : 'structure'),
  set: (v) => router.replace({ query: { ...route.query, volet: v } }),
})
</script>

<style scoped>
.config-view {
  padding: 1.25em;
  /* La DocumentBar est en position absolue AU-DESSUS de la zone de défilement
     (translucide, le contenu défile derrière) : sans réserver sa hauteur, le
     titre se lit à travers la barre. --bar-size est la même variable qui donne
     sa hauteur à la barre — pas un nombre magique à resynchroniser. */
  padding-top: calc(var(--bar-size) + 1.25em);
  max-width: 70em;
}

.config-header h2 {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-lg);
}

.volets {
  display: flex;
  gap: var(--sp-2);
  margin: var(--sp-4) 0;
  border-bottom: 1px solid var(--c-border);
}

.volet {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--fs-md);
  cursor: pointer;
  opacity: var(--op-muted);
}

.volet--active {
  border-bottom-color: var(--c-accent);
  opacity: 1;
  font-weight: 600;
}

.volet__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  border-radius: var(--radius-pill);
  background: var(--c-surface3);
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
}

.volet--active .volet__num {
  background: var(--c-accent);
  color: #fff;
}
</style>
