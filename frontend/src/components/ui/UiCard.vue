<template>
  <section class="ui-card" :class="{ 'ui-card--wide': wide }">
    <header class="ui-card__header">
      <h2>{{ title }}</h2>
      <i v-if="busy" class="pi pi-spin pi-spinner ui-card__busy"></i>
    </header>

    <div class="ui-card__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  wide: { type: Boolean, default: false },
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
