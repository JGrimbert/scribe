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
  /* Dans une row bornée au rail, le select doit accepter de rétrécir. */
  min-width: 0;
  max-width: 100%;
}

.bare-select select {
  appearance: none;
  -webkit-appearance: none;
  border: 1px solid var(--c-accent2);
  border-radius: var(--radius-sm);
  /* Même voile que la pastille d'unité de `NumInput` : les deux champs d'une row
     partagent une seule encre de fond, posée sur la plaque de la row. */
  background: color-mix(in srgb, var(--c-accent-alt-ink) 24%, transparent);
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-sm);
  padding: var(--sp-1) 1.6em var(--sp-1) var(--sp-2);
  margin: 0;
  cursor: pointer;
  /* 11em au repos (un libellé long n'étire pas le champ), mais jamais plus que la
     place que la row lui laisse. */
  max-width: min(11em, 100%);
  text-overflow: ellipsis;
}

/* La liste déroulée hérite sinon du fond TRANSLUCIDE du champ : posée sur le
   papier, elle devient illisible. Elle, c'est du blanc plein. */
.bare-select option {
  background: var(--c-surface0);
  color: var(--c-ink);
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
