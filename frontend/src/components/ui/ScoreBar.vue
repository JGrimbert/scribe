<template>
  <span class="score-bar">
    <span class="score-bar__track" :style="{ width: trackWidth }">
      <span class="score-bar__fill" :style="{ width: clamped + '%' }"></span>
    </span>
    <span v-if="label" class="score-bar__label">{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  pct: { type: Number, required: true },
  label: { type: String, default: null },
  trackWidth: { type: String, default: '8em' },
})

const clamped = computed(() => Math.min(100, Math.max(0, props.pct)))
</script>

<style scoped>
.score-bar {
  display: inline-flex;
  align-items: center;
  gap: 0.6em;
}

.score-bar__track {
  display: inline-block;
  height: 0.5em;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.08);
  overflow: hidden;
  flex-shrink: 0;
}

.score-bar__fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--c-accent);
}

.score-bar__label {
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-md);
  white-space: nowrap;
}
</style>
