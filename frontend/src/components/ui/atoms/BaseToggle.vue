<template>
  <!-- Interrupteur on/off custom. `muted` = grisé mais TOUJOURS cliquable (état
       « suit le défaut » : cliquer pose une valeur explicite). `disabled` = inerte. -->
  <button
      type="button"
      class="base-toggle"
      :class="{ 'base-toggle--on': modelValue, 'base-toggle--muted': muted }"
      role="switch"
      :aria-checked="modelValue ? 'true' : 'false'"
      :disabled="disabled"
      @click="$emit('update:modelValue', !modelValue)"
  >
    <span class="base-toggle__knob"></span>
  </button>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  // Grisé mais actif (la valeur affichée vient d'ailleurs — .odt — tant qu'on n'y
  // touche pas). Distinct de `disabled`, qui bloque le clic.
  muted: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
defineEmits(['update:modelValue'])
</script>

<style scoped>
.base-toggle {
  --tg-w: 2.2rem;
  --tg-h: 1.25rem;
  position: relative;
  flex: 0 0 auto;
  width: var(--tg-w);
  height: var(--tg-h);
  padding: 0;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--c-ink) 22%, transparent);
  cursor: pointer;
  transition: background 0.18s ease, opacity 0.18s ease;
}

.base-toggle--on {
  background: var(--c-accent-alt);
}

.base-toggle--muted {
  opacity: var(--op-muted, 0.45);
}

.base-toggle:disabled {
  cursor: not-allowed;
  opacity: var(--op-faint, 0.3);
}

.base-toggle__knob {
  position: absolute;
  top: 50%;
  left: 3px;
  width: calc(var(--tg-h) - 6px);
  height: calc(var(--tg-h) - 6px);
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  /* Compositor-only : on ne translate que le bouton. */
  transform: translate(0, -50%);
  transition: transform 0.18s ease;
}

.base-toggle--on .base-toggle__knob {
  transform: translate(calc(var(--tg-w) - var(--tg-h)), -50%);
}
</style>
