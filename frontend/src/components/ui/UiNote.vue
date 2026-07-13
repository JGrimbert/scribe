<template>
  <!-- hint : légende explicative inline, non encadrée -->
  <p v-if="variant === 'hint'" class="ui-note--hint">
    <slot />
  </p>

  <!-- state / error : bloc callout avec cartouche (Info / Échec) -->
  <UiCallout
      v-else
      :tone="variant === 'error' ? 'error' : 'info'"
      :title="variant === 'error' ? 'Échec' : 'Info'"
      truncate
  >
    <slot />
  </UiCallout>
</template>

<script setup>
import UiCallout from './UiCallout.vue'

defineProps({
  variant: {
    type: String,
    default: 'state',
    validator: (v) => ['state', 'error', 'hint'].includes(v),
  },
})
</script>

<style scoped>
/* hint : légende explicative — state/error sont désormais rendus par UiCallout */
.ui-note--hint {
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-sm);
  opacity: var(--op-muted);
}
</style>
