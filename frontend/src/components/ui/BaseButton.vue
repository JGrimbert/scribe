<template>
  <component
      :is="as"
      class="base-button"
      :class="[
        `base-button--${variant}`,
        { 'base-button--active': active, 'base-button--blocked': as !== 'button' && (disabled || busy) },
      ]"
      :type="as === 'button' ? type : undefined"
      :disabled="as === 'button' ? disabled || busy : undefined"
  >
    <i v-if="busy" class="pi pi-spin pi-spinner"></i>
    <i v-else-if="icon" class="pi" :class="icon"></i>
    <slot />
  </component>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'outline',
    validator: (v) => ['accent', 'solid', 'solid-alt', 'outline', 'ghost'].includes(v),
  },
  icon: { type: String, default: null },
  busy: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  // ghost uniquement : force l'opacité pleine (état "toggle actif")
  active: { type: Boolean, default: false },
  // 'label' pour un bouton-fichier (input hidden dans le slot)
  as: { type: String, default: 'button' },
  type: { type: String, default: 'button' },
})
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  font: inherit;
  font-size: var(--fs-sm);
  line-height: 1.2;
  padding: 0.45em 0.9em;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: none;
  color: inherit;
  cursor: pointer;
}

.base-button:disabled,
.base-button--blocked {
  opacity: 0.55;
  cursor: wait;
  pointer-events: none;
}

.base-button--accent {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.base-button--accent:hover:not(:disabled) {
  background: var(--c-surface3);
}

.base-button--solid {
  background: var(--c-accent);
  border-color: var(--c-accent);
  color: #fff;
}

.base-button--solid:hover:not(:disabled) {
  filter: brightness(1.12);
}

.base-button--solid-alt {
  background: var(--c-accent-alt);
  border-color: var(--c-accent-alt);
  color: var(--c-accent-alt-ink);
}

.base-button--solid-alt:hover:not(:disabled) {
  filter: brightness(1.12);
}

.base-button--outline {
  border-color: var(--c-border);
}

.base-button--outline:hover:not(:disabled) {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.base-button--ghost {
  padding: 0.25em;
  opacity: var(--op-muted);
}

.base-button--ghost:hover:not(:disabled),
.base-button--ghost.base-button--active {
  opacity: 1;
}
</style>
