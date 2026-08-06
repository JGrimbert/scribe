<template>
  <!-- Champ numérique NU (ni fond ni cadre) : la valeur, discrètement soulignée,
       suivie de l'unité. Émet la saisie BRUTE (conversion faite par l'hôte). -->
  <span class="num-input">
    <input
        type="number" min="0" :step="step" inputmode="decimal" :placeholder="placeholder"
        :value="value" :disabled="disabled"
        @input="$emit('input', $event.target.value)"
    />
    <span v-if="unit" class="num-input__unit">{{ unit }}</span>
  </span>
</template>

<script setup>
defineProps({
  value: { type: [Number, String], default: '' },
  step: { type: [Number, String], default: 0.1 },
  unit: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
defineEmits(['input'])
</script>

<style scoped>
/* Boîte bordée UNIQUE : le nombre + son unité, l'unité en pastille teal accolée. */
.num-input {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--c-accent2);
  border-radius: var(--radius-sm);
 /* background: var(--c-surface0);*/
  overflow: hidden;
}

.num-input:focus-within {
  border-color: var(--c-accent-alt);
}

.num-input input {
  width: 3.4em;
  border: none;
  background: #fff;
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
  padding: var(--sp-1) var(--sp-2);
  text-align: right;
}

.num-input input:focus {
  outline: none;
}

.num-input input:disabled {
  opacity: var(--op-muted);
  cursor: not-allowed;
}

/* Unité : teal sur teal léger, dans la même boîte que le nombre. */
.num-input__unit {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--c-accent);
  /*background: color-mix(in srgb, var(--c-accent-alt) 12%, var(--c-surface0));*/
  background:
      color-mix(in srgb, var(--c-accent-alt-ink) 24%, transparent);
}
</style>
