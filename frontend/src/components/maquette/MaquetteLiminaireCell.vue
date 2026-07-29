<template>
  <!-- Un vis-à-vis liminaire dans l'accordéon Maquette : les deux folios physiques
       (verso · recto), rendus par LiminaireFolio comme dans LiminaireAccordeon. -->
  <div class="lim-cell">
    <div
        v-for="(cell, ci) in [spread.left, spread.right]"
        :key="ci"
        class="lim-slot"
        :class="ci === 0 ? 'is-left' : 'is-right'"
    >
      <LiminaireFolio :cell="cell" :type="typeOf(cell)" :suggestion="suggestionOf(cell)" />
    </div>
  </div>
</template>

<script setup>
import LiminaireFolio from '../liminaire/LiminaireFolio.vue'

const props = defineProps({
  spread: { type: Object, required: true },
  types: { type: Object, required: true },
  suggestions: { type: Object, required: true },
})

function typeOf(cell) {
  return cell?.page ? (props.types[cell.page.key] ?? '') : ''
}

function suggestionOf(cell) {
  return cell?.page ? (props.suggestions[cell.page.key] ?? null) : null
}
</script>

<style scoped>
.lim-cell {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: min(100%, 22em);
}

.lim-slot {
  display: flex;
}

/* La reliure : le bord intérieur (droite du verso, gauche du recto) plus marqué —
   le folio est la racine d'un composant enfant → :deep(). */
.is-left :deep(.folio) { border-right-width: 2px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.is-right :deep(.folio) { border-left-width: 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; }
</style>
