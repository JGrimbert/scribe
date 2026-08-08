<template>
  <!-- Jalon Chapitrage : aperçu léger du nœud survolé (validation), styles du
       vis-à-vis « exigé » posés sur la planche, et volet des familles de cas ferré
       en bas de fenêtre quand la validation est ouverte. -->
  <MaquetteFragmentPreview
      v-if="showGroupes && hoveredNode"
      :node="hoveredNode"
      :node-id="hoveredGroup?.nodes[0]?.nodeId ?? null"
      :depth="mainDepth"
      :visuals="effectiveVisuals"
      :ratio="previewRatio"
  />

  <!-- Fuyantes tues tant que la géométrie est périmée (scroll rapide) : sinon elles
       clignotent sur les rects du cran précédent le temps de la repagination. -->
  <MaquetteStyleCallouts
      v-if="!geometryStale"
      :geometry="spreadGeometry"
      :style-geometry="styleGeometry"
      :styles="chapSpreadStyles"
      :style-roles="styles"
      show-require
      :depth-key="focusedSection?.depthKey ?? null"
      :zone-key="focusedSection?.zone.key ?? null"
      :rule-set="focusedSection?.ruleSet ?? rules.default"
      @hover-style="setHoveredStyle"
  />

  <MaquetteGroupes
      v-if="showGroupes"
      class="maq-groupes-zone"
      :groups="deviationGroups"
      :hovered="hoveredGroup?.key ?? null"
      :suggestion="mergeSuggestion"
      :corps-suggestion="corpsSuggestion"
      :merging="merging"
      :style-rows="styleRows"
      :style-roles="styles"
      :depth-key="focusedSection?.depthKey ?? 0"
      :zone-key="focusedSection?.zone.key ?? null"
      :rule-set="focusedSection?.ruleSet ?? rules.default"
      @hover-group="onHoverGroup"
      @merge="applyMerge"
      @hover-style="setHoveredStyle"
  />
</template>

<script setup>
import { inject } from 'vue'
import MaquetteStyleCallouts from '../MaquetteStyleCallouts.vue'
import MaquetteFragmentPreview from '../MaquetteFragmentPreview.vue'
import MaquetteGroupes from '../MaquetteGroupes.vue'

const {
  spreadGeometry, styleGeometry, styles, rules, focusedSection,
  chapSpreadStyles, mainDepth, effectiveVisuals, previewRatio,
  showGroupes, hoveredNode, hoveredGroup,
  deviationGroups, mergeSuggestion, corpsSuggestion, merging, styleRows,
  onHoverGroup, applyMerge, setHoveredStyle, geometryStale,
} = inject('maq')
</script>

<style scoped>
/* Volet des familles de cas : ferré EN BAS de la fenêtre, remontant assez haut pour
   recouvrir le bas de la planche (`--maq-groupes-h`, hérité de `.maquette`). Passe
   devant le dock (z 160), sous les modales (z 200). Depuis la gouttière du sommaire
   jusqu'au bord droit. En `rem` : le volet pose sa propre font-size. La classe est
   posée sur la racine de MaquetteGroupes (scope parent hérité par le root enfant). */
.maq-groupes-zone {
  position: fixed;
  left: 17rem;
  right: 0em;
  bottom: 0em;
  height: var(--maq-groupes-h);
  z-index: 165;
  padding-top: var(--sp-4);
}
</style>
