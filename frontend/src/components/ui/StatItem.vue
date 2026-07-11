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
.stat-item {
  display: flex;
  align-items: baseline;
  gap: 0.45em;
}

.stat-item__value {
  font-size: var(--fs-lg);
  font-variant-numeric: tabular-nums;
}

.stat-item__label {
  font-size: var(--fs-sm);
  opacity: var(--op-muted);
}
</style>
