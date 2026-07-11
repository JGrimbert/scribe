<template>
  <div class="ui-table-wrap" :class="{ 'ui-table-wrap--scroll': scroll }">
    <table class="ui-table">
      <slot />
    </table>
  </div>
</template>

<script setup>
defineProps({
  // Défilement interne — usage exceptionnel (listes non tronquables) :
  // partout ailleurs, tronquer plutôt que scroller.
  scroll: { type: Boolean, default: false },
})
</script>

<style scoped>
.ui-table-wrap--scroll {
  max-height: 24em;
  overflow-y: auto;
}

.ui-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-md);
  margin-top: var(--sp-2);
}

/* le contenu (thead/tbody) vient du slot → :deep obligatoire */
.ui-table :deep(th),
.ui-table :deep(td) {
  text-align: left;
  padding: 0.4em 0.6em;
  border-bottom: 1px solid var(--c-border);
}

.ui-table-wrap--scroll .ui-table :deep(thead th) {
  position: sticky;
  top: 0;
  background: var(--c-bg);
}

.ui-table :deep(.num) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.ui-table :deep(.row-link) {
  cursor: pointer;
}

.ui-table :deep(.row-link:hover) {
  background: var(--c-surface3);
}
</style>
