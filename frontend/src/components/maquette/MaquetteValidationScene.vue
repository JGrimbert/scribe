<template>
  <!-- Panneau de validation frag, EN REGARD des lambeaux. Vit dans la COQUILLE (pas le
       pane routé) pour survivre au changement de route et GLISSER en entrée ET en sortie.
       Le CLIP (fixed, sous les barres, overflow hidden) borne le glissement à la zone
       folio ; la couche interne porte le transform du slide (`slideStyle`). -->
  <div class="maq-annot-clip" :style="{ left: scene.analyseLeft }">
    <div class="maq-annot-scene" :style="slideStyle">
      <MaquetteAnnotations :rules="rules" :char-counts="annotationCharCounts" />
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import MaquetteAnnotations from './MaquetteAnnotations.vue'

defineProps({
  // Transform/transition du slide (mirroir du slot de la vue) — appliqué à la couche interne.
  slideStyle: { type: Object, default: () => ({}) },
  // Scène FIGÉE de la vue (analyseLeft…) : ancrage horizontal stable pendant la sortie.
  scene: { type: Object, default: () => ({}) },
})

const { rules, annotationCharCounts } = inject('maq')
</script>

<style scoped>
/* Clip : fixe la scène sous les barres (la pile de barres est comptée), bornée au-dessus
   du dock, et borne le GLISSEMENT vertical → le panneau émerge du haut de la zone folio
   sans recouvrir le menu du haut. Le bord gauche suit la géométrie émise (bord droit de
   la page de lambeaux) ; le droit tient une petite marge. */
.maq-annot-clip {
  position: fixed;
  right: 1em;
  top: 0;
  bottom: calc(var(--maq-dock-h) + var(--sp-4));
  z-index: 2;
  overflow: hidden;
}

/* Couche interne : le panneau + le glissement (slideStyle). Ferrée dans la ZONE FOLIO
   (sous les barres) au repos ; en glissant elle traverse la bande des barres, qui la
   couvrent. */
.maq-annot-scene {
  position: absolute;
  top: calc(4em + var(--bar-size));
  left: 0;
  right: 0;
  bottom: 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
