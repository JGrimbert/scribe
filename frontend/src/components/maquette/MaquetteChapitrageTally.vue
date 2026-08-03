<template>
  <!-- Décompte par niveau de chapitrage : où en est la relecture du livre.
       Trois états qui se lisent d'un coup d'œil sur une barre 100 % — validés
       (décision humaine), validables non validés (en règle, pas encore relus),
       le reste (à retravailler). Le niveau courant est appuyé ; cliquer un autre
       niveau y va. -->
  <ul class="tally">
    <li v-for="row in rows" :key="row.index" class="tally__row" :class="{ 'tally__row--active': row.index === activeIndex }">
      <button type="button" class="tally__label" @click="$emit('select', row.index)">
        {{ row.label }}
      </button>

      <StackedBar :segments="segmentsOf(row)" width="6em" />

      <span class="tally__counts">
        <span class="tally__pct">{{ pct(row.validables, row.total) }} %</span>
        <span class="tally__detail">{{ row.validables }} validables · {{ row.valides }} validés / {{ row.total }}</span>
      </span>
    </li>
  </ul>
</template>

<script setup>
import StackedBar from '../ui/atoms/StackedBar.vue'

defineProps({
  // [{ index, label, depthKey, total, validables, valides, perimes, fromModel }]
  rows: { type: Array, default: () => [] },
  // Rang du niveau focusé (surligné).
  activeIndex: { type: Number, default: null },
})

defineEmits(['select'])

// Un nœud validé mais qui ne passe plus les contraintes reste compté comme
// validé : la décision humaine prime sur le relevé de styles. D'où le `max(0)`
// sur les validables non validés, qui pourraient sinon passer sous zéro.
function segmentsOf(row) {
  return [
    { key: 'valides', value: row.valides, color: 'var(--c-status-valide)', label: 'Validés' },
    {
      key: 'validables',
      value: Math.max(0, row.validables - row.valides),
      color: 'var(--c-accent-alt)',
      label: 'Validables non validés',
    },
    {
      key: 'reste',
      value: Math.max(0, row.total - Math.max(row.validables, row.valides)),
      color: 'var(--c-border)',
      label: 'Hors contraintes',
    },
  ]
}

function pct(n, total) {
  return total ? Math.round((n / total) * 100) : 0
}
</script>

<style scoped>
.tally {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.tally__row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-ink2);
}

/* Niveau focusé : le seul en encre pleine — les autres sont du contexte. */
.tally__row--active {
  color: var(--c-ink);
  font-weight: 600;
}

.tally__label {
  flex: 0 0 8.5em;
  text-align: left;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.tally__label:hover {
  color: var(--c-accent-alt);
}

.tally__counts {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.tally__pct {
  font-weight: 600;
}

/* Le détail chiffré n'est pas la lecture principale : il double la barre. */
.tally__detail {
  font-size: var(--fs-xs);
  opacity: var(--op-muted);
  white-space: nowrap;
}
</style>
