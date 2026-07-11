<template>
  <div class="stat-item">
    <span class="stat-item__value">{{ value }}</span>
    <span class="stat-item__label">{{ label }}</span>
  </div>
</template>

<script setup>
defineProps({
  value: { type: [String, Number], required: true },
  label: { type: String, required: true },
})
</script>

<style scoped>
/* Chaque stat est sa propre tuile — même chrome que UiCard. */
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.15em;
  padding: 0.55em 0.85em;
  background: var(--c-surface);
  backdrop-filter: var(--c-backdrop-filter-blur);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
}

.stat-item__value {
  font-size: var(--fs-lg);
  font-variant-numeric: tabular-nums;
}

.stat-item__label {
  font-size: var(--fs-xs);
  opacity: var(--op-muted);
  white-space: nowrap;
}
</style>
