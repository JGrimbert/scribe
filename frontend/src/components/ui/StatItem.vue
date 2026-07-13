<template>
  <div class="stat-item" :class="{ 'stat-item--empty': empty }">
    <span class="stat-item__value">{{ empty ? '—' : value }}</span>
    <span class="stat-item__label">
      {{ label }}
      <UiHint v-if="hint" :text="hint" />
    </span>
  </div>
</template>

<script setup>
import UiHint from './UiHint.vue'

defineProps({
  value: { type: [String, Number], default: null },
  label: { type: String, required: true },
  // Texte d'infobulle : « ? » à côté du label, bulle au survol de la tuile.
  hint: { type: String, default: null },
  // Aucune valeur calculée : affiche « — », la tuile occupe l'espace.
  empty: { type: Boolean, default: false },
})
</script>

<style scoped>
/* Chaque stat est sa propre tuile — même chrome que UiCard. Tout centré,
   valeur comme label. Pas de curseur/sélection de texte. */
.stat-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.15em;
  padding: 0.55em 0.85em;
  background: var(--c-surface);
  backdrop-filter: var(--c-backdrop-filter-blur);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  cursor: default;
  user-select: none;
}

.stat-item--empty .stat-item__value {
  opacity: var(--op-muted);
}

.stat-item__value {
  font-size: var(--fs-lg);
  font-variant-numeric: tabular-nums;
}

.stat-item__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35em;
  font-size: var(--fs-xs);
  opacity: var(--op-muted);
  white-space: nowrap;
}
</style>
