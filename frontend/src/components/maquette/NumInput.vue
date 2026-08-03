<template>
  <!-- Champ numérique NU (ni fond ni cadre) : la valeur, discrètement soulignée,
       suivie de l'unité. Émet la saisie BRUTE (conversion faite par l'hôte). -->
  <span class="num-input">
    <input
        type="number" min="0" :step="step" inputmode="decimal" :placeholder="placeholder"
        :value="value"
        @input="$emit('input', $event.target.value)"
    />
    <span class="num-input__unit">{{ unit }}</span>
  </span>
</template>

<script setup>
defineProps({
  value: { type: [Number, String], default: '' },
  step: { type: [Number, String], default: 0.1 },
  unit: { type: String, default: '' },
  placeholder: { type: String, default: '' },
})
defineEmits(['input'])
</script>

<style scoped>
.num-input {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.num-input input {
  width: 2.8em;
  border: none;
  background: transparent;
  border-bottom: 1px solid var(--c-border);
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
  padding: 0 0 1px;
  text-align: right;
}

.num-input input:focus {
  outline: none;
  border-bottom-color: var(--c-accent, var(--c-ink2));
}

.num-input__unit {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}
</style>
