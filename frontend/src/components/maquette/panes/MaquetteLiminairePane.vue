<template>
  <!-- Jalon Liminaire : styles du vis-à-vis posés SUR la planche (callouts ferrés
       au rail droit) + overlay des contrôles (select de type, chevrons, découpage).
       Tout est ancré sur la géométrie émise par le FolioView persistant du shell. -->
  <!-- Fuyantes tues tant que la géométrie est périmée (scroll rapide) : sinon elles
       clignotent sur les rects du cran précédent le temps de la repagination. -->
  <MaquetteStyleCallouts
      v-if="!geometryStale"
      :geometry="spreadGeometry"
      :style-geometry="styleGeometry"
      :styles="limSpreadStyles"
      :style-roles="styles"
      zone-key="liminaire"
      @hover-style="setHoveredStyle"
  />

  <div class="lim-hover__controls">
    <LiminaireControls
        :geometry="spreadGeometry"
        :block-geometry="blockGeometry"
        :spread="limFocusedSpread"
        :types="limTypes"
        :suggestions="limSuggestions"
        :config="liminaireConfig"
        :focused="limFocused"
        :spread-count="limSpreads.length"
        @set-type="limSetType"
        @update:focused="setLimFocused"
    />
  </div>
</template>

<script setup>
import { inject } from 'vue'
import MaquetteStyleCallouts from '../MaquetteStyleCallouts.vue'
import LiminaireControls from '../../liminaire/LiminaireControls.vue'

const {
  spreadGeometry, styleGeometry, blockGeometry, styles,
  limSpreadStyles, limFocusedSpread, limTypes, limSuggestions,
  liminaireConfig, limFocused, limSpreads,
  limSetType, setLimFocused, setHoveredStyle, geometryStale,
} = inject('maq')
</script>

<style scoped>
/* Overlay des contrôles liminaire, posé SUR la planche (outlines + flèches de
   découpage). Visible en permanence — les outlines des éléments doivent l'être
   (LiminaireControls gate lui-même les flèches au survol). Racine inerte : chaque
   contrôle rétablit le pointeur. Au-dessus de l'iframe (z-index 1 en double-page). */
.lim-hover__controls {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}
</style>
