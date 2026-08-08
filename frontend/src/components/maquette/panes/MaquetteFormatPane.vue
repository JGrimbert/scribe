<template>
  <!-- Jalon Format : les contrôles de format DOCKÉS sur l'aperçu (cartes ferrées
       aux bords + traits vers les zones réglées, alimentées par la géométrie émise
       par le FolioView persistant du shell). -->
  <!-- Fuyantes tues tant que la géométrie est périmée (scroll rapide) : sinon elles
       clignotent sur les rects du cran précédent le temps de la repagination. -->
  <MaquetteFormatCallouts
      v-if="!geometryStale"
      :page="fmtPage"
      :style-defaults="styleDefaults"
      :geometry="spreadGeometry"
  />
</template>

<script setup>
import { inject } from 'vue'
import MaquetteFormatCallouts from '../MaquetteFormatCallouts.vue'

// Modèle partagé fourni par la coquille (MaquetteView) : le folio reste persistant
// dans le shell, le pane n'apporte que ses overlays.
const { fmtPage, styleDefaults, spreadGeometry, geometryStale } = inject('maq')
</script>
