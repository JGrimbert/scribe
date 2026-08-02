<template>
  <!-- Chiffres du document, sans décor propre (l'hôte porte le fond) : en ligne
       qui se replie pour un bandeau étroit, en grille pour un panneau large. -->
  <div class="doc-stats" :class="`doc-stats--${variant}`">
    <span
        v-for="item in items"
        :key="item.label"
        class="doc-stat"
        :title="item.hint || undefined"
    >
      <b class="doc-stat__value">{{ item.empty ? '—' : item.value }}</b>
      <span class="doc-stat__label">{{ item.label }}</span>
    </span>
  </div>
</template>

<script setup>
defineProps({
  // Tuiles { label, value, hint, empty } — cf. `useDocStats`.
  items: { type: Array, required: true },
  variant: { type: String, default: 'inline' }, // 'inline' | 'grid'
})
</script>

<style scoped>
.doc-stats {
  flex: 0 0 auto;
  color: var(--c-ink2);
  font-size: var(--fs-xs);
}

/* Bandeau DISCRET : pas d'aplat coloré, une ligne de chiffres sourds qui se
   replie si la place manque. */
.doc-stats--inline {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3em 1.2em;
  padding: 0.4em 0.6em;
}

/* Panneau du dock : DEUX colonnes de chiffres menus, valeurs ferrées à droite pour
   qu'elles s'alignent. Volontairement discret — c'est un repère, pas un tableau de
   bord : d'où la largeur bornée, qui l'empêche de s'étaler dans la bande. Le décor
   est PORTÉ ICI (le panneau hôte n'a pas de fond) : carte flottante posée sur la
   pellicule, qui reste lisible dessous. */
.doc-stats--grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.15em 1.6em;
  max-width: 22em;
  padding: var(--sp-3);
  border-radius: var(--radius-md);
  background: var(--c-card-float);
  backdrop-filter: var(--c-backdrop-filter-blur);
}

.doc-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3em;
}

.doc-stats--grid .doc-stat {
  display: grid;
  grid-template-columns: 4.5em auto;
  gap: 0.4em;
}

.doc-stats--grid .doc-stat__value {
  text-align: right;
}

.doc-stat__value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.doc-stat__label {
  opacity: var(--op-muted);
}
</style>
