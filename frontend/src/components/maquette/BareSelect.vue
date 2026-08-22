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
/* Boîte bordée UNIQUE, calquée sur `NumInput` : champ BLANC à gauche, pastille
   chevron (voile) accolée à droite — les deux champs d'une row se lisent pareil. */
.bare-select {
  display: inline-flex;
  align-items: stretch;
  /* Dans une row bornée au rail, le select doit accepter de rétrécir. */
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--c-accent2);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.bare-select:focus-within {
  border-color: var(--c-accent-alt);
}

.bare-select select {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  background: #fff;
  color: var(--c-ink);
  font: inherit;
  font-size: var(--fs-sm);
  padding: var(--sp-1) var(--sp-2);
  margin: 0;
  cursor: pointer;
  min-width: 0;
  /* 11em au repos (un libellé long n'étire pas le champ), mais jamais plus que la
     place que la row lui laisse. */
  max-width: min(11em, 100%);
  text-overflow: ellipsis;
}

/* La liste déroulée hérite sinon du fond du champ : on la force en blanc plein. */
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
}

/* Pastille chevron : même voile que l'unité de `NumInput`, l'élément « cliquable »
   qui garde la teinte pendant que le champ passe en blanc. */
.bare-select__chevron {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--sp-2);
  font-size: 0.7em;
  color: var(--c-ink2);
  background: color-mix(in srgb, var(--c-accent-alt-ink) 24%, transparent);
  pointer-events: none;
}
</style>
