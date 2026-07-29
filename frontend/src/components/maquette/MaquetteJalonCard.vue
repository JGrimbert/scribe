<template>
  <!-- Jalon « nu » : un simple marqueur de frontière entre deux sources, sans
       action — défaut d'un jalon pas (encore) porteur d'un geste. -->
  <div class="jalon-card">
    <i class="pi pi-flag-fill" aria-hidden="true"></i>
    <span class="jalon-label">{{ label }}</span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
})
</script>

<style scoped>
.jalon-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  height: 9em;
  justify-content: center;
  padding: var(--sp-3);
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--c-accent-alt-darker) 5%, var(--c-surface));
}

.jalon-card i {
  color: var(--c-accent-alt-darker);
  font-size: var(--fs-lg);
}

.jalon-label {
  text-align: center;
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}
</style>
