<template>
  <!-- Select NU (ni fond ni cadre) des callouts de format : juste le libellé + un
       chevron. La valeur reste lisible posée sur le folio ou dans la colonne. -->
  <span class="bare-select" :class="{ 'bare-select--muted': muted }">
    <select :value="modelValue" :disabled="disabled" @change="$emit('update:modelValue', $event.target.value)">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <i class="bare-select__chevron pi pi-angle-down" aria-hidden="true"></i>
  </span>
</template>

<script setup>
defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  muted: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
defineEmits(['update:modelValue'])
</script>

<style scoped>
.bare-select {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.bare-select select {
  appearance: none;
  -webkit-appearance: none;
  border: 1px solid var(--c-accent2);
  border-radius: var(--radius-sm);
  background: var(--c-surface0);
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-sm);
  padding: var(--sp-1) 1.6em var(--sp-1) var(--sp-2);
  margin: 0;
  cursor: pointer;
  max-width: 11em;
  text-overflow: ellipsis;
}

.bare-select--muted select {
  color: var(--c-ink2);
}

.bare-select select:disabled {
  opacity: var(--op-muted);
  cursor: not-allowed;
}

.bare-select select:focus {
  outline: none;
  border-color: var(--c-accent, var(--c-ink2));
}

.bare-select__chevron {
  position: absolute;
  right: var(--sp-2);
  font-size: 0.7em;
  color: var(--c-ink2);
  pointer-events: none;
}
</style>
