<template>
  <p class="ui-note" :class="`ui-note--${variant}`">
    <slot />
  </p>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'state',
    validator: (v) => ['state', 'error', 'hint'].includes(v),
  },
})
</script>

<style scoped>
/* state : message d'attente/vide — error : échec — hint : légende explicative */
.ui-note--state {
  padding: var(--sp-4) 0;
  opacity: var(--op-muted);
}

.ui-note--error {
  padding: var(--sp-4) 0;
  color: var(--c-danger);
}

.ui-note--hint {
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-sm);
  opacity: var(--op-muted);
}
</style>
