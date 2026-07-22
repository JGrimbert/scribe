<template>
  <section class="ui-card" :class="{ 'ui-card--wide': wide, 'ui-card--bare': bare }">
    <header v-if="title || busy" class="ui-card__header">
      <h2 v-if="title">{{ title }}</h2>
      <i v-if="busy" class="pi pi-spin pi-spinner ui-card__busy"></i>
    </header>

    <div class="ui-card__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  // optionnel : sans titre (ni busy), l'en-tête n'est pas rendu du tout
  title: { type: String, default: null },
  wide: { type: Boolean, default: false },
  // sans fond/bordure/flou : la card se fond dans la grille (ex : nuage de mots)
  bare: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
</script>

<style scoped>
.ui-card {
  background: var(--c-surface);
  backdrop-filter: var(--c-backdrop-filter-blur);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
}

.ui-card--wide {
  grid-column: 1 / -1;
}

.ui-card--bare {
  background: none;
  border: none;
  backdrop-filter: none;
  border-radius: 0;
}

.ui-card__header {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 0.8em 1.1em 0;
}

.ui-card__header h2 {
  margin: 0;
  font-size: 0.78em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  opacity: 0.65;
}

.ui-card__busy {
  font-size: 0.85em;
  color: var(--c-accent);
}

.ui-card__body {
  padding: 0.2em 1.1em 1.1em;
}

/* titres de sections internes aux cards */
.ui-card__body :deep(h3) {
  margin: 1.5em 0 0.25em;
  font-size: 1em;
}

.ui-card__body :deep(h3:first-child) {
  margin-top: 0.5em;
}
</style>
