<template>
  <div class="chip-group">
    <h4 v-if="title" class="chip-group__title">
      {{ title }}
      <span v-if="meta" class="chip-group__meta">({{ meta }})</span>
    </h4>
    <div class="chip-group__chips">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: null },
  // texte libre entre parenthèses, ex: "63, 24 affichées"
  meta: { type: String, default: null },
})
</script>

<style scoped>
.chip-group {
  margin-top: var(--sp-3);
}

.chip-group__title {
  margin: 0 0 0.4em;
  font-size: var(--fs-md);
  opacity: var(--op-soft);
}

.chip-group__meta {
  font-weight: normal;
  opacity: var(--op-muted);
}

.chip-group__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em;
}
</style>
