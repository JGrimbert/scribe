<template>
  <!-- Un vis-à-vis liminaire dans l'accordéon Maquette : les deux folios physiques
       (verso · recto), rendus par LiminaireFolio comme dans LiminaireAccordeon. -->
  <div class="lim-cell" :style="{ '--maq-ratio': ratio }">
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
  // Ratio largeur/hauteur d'une page (défaut A5 portrait).
  ratio: { type: Number, default: 148 / 210 },
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
  display: flex;
  gap: 2px;
  height: 100%;
  justify-content: center;
}

.lim-slot {
  display: flex;
  height: 100%;
}

/* La cellule impose la HAUTEUR (celle du cran) et le ratio de la page effective ;
   LiminaireFolio, sinon dimensionné en largeur (max-width + aspect 1/1.414), suit. */
.lim-slot :deep(.folio) {
  height: 100%;
  width: auto;
  max-width: none;
  aspect-ratio: var(--maq-ratio, 0.7);
}

/* La reliure : le bord intérieur (droite du verso, gauche du recto) plus marqué —
   le folio est la racine d'un composant enfant → :deep(). */
.is-left :deep(.folio) { border-right-width: 2px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.is-right :deep(.folio) { border-left-width: 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; }
</style>
