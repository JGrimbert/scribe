<template>
  <!-- Les actions de borne (étendre / exclure / redéfinir) partagent leur
       signature : ce sont les faces d'un même geste (déplacer la fin du
       liminaire). Une seule définition, réutilisée des deux côtés de la scène. -->
  <button
      type="button"
      class="lim-border-btn"
      :class="{ 'lim-border-btn--ghost': ghost }"
      :disabled="disabled"
      :title="title"
  >
    <i v-if="icon" :class="`pi ${icon}`"></i>
    <slot />
  </button>
</template>

<script setup>
defineProps({
  icon: { type: String, default: null },
  disabled: { type: Boolean, default: false },
  title: { type: String, default: null },
  // Action secondaire (redéfinir) : moins appuyée, ouvre la modale de recalibrage.
  ghost: { type: Boolean, default: false },
})
</script>

<style scoped>
.lim-border-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-sm);
  padding: 0.35em 0.9em;
  cursor: pointer;
}

.lim-border-btn:hover:not(:disabled) {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.lim-border-btn:disabled {
  opacity: var(--op-faint);
  cursor: default;
}

/* Action secondaire du même bloc : elle ouvre la modale (donc engage un
   recalibrage), là où « Étendre » ne fait qu'un aperçu. Moins appuyée. */
.lim-border-btn--ghost {
  border-color: transparent;
  background: none;
  font-size: var(--fs-xs);
  text-decoration: underline;
}
</style>
