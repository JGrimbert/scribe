<template>
  <section class="analyse-card" :class="{ 'analyse-card--wide': wide }">
    <header class="card-header">
      <h2>{{ title }}</h2>
      <i v-if="busy" class="pi pi-spin pi-spinner busy-icon"></i>
    </header>

    <div class="card-body">
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
.analyse-card {
  background: var(--c-surface, rgba(255, 255, 255, 0.8));
  backdrop-filter: var(--c-backdrop-filter-blur);
  border: 1px solid var(--c-border, #e0d8cc);
  border-radius: 4px;
}

.analyse-card--wide {
  grid-column: 1 / -1;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75em;
  padding: 0.8em 1.1em 0;
}

.card-header h2 {
  margin: 0;
  font-size: 0.78em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  opacity: 0.65;
}

.busy-icon {
  font-size: 0.85em;
  color: var(--c-accent);
}

.card-body {
  padding: 0.2em 1.1em 1.1em;
}
</style>
