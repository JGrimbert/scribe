<template>
  <!-- Panneau main d'une source chapitrage : l'aperçu témoin en DOUBLE-PAGE
       (FolioView mode spread). Le nœud témoin vient de la sélection des « modèles
       relevés », désormais dans l'aside (`MaquetteChapitreModels`) → l'état de
       sélection est levé dans MaquetteView, ce composant ne reçoit que le résultat. -->
  <div class="maq-chap">
    <FolioView
        mode="spread"
        :visible-pages="2"
        :data="data"
        :node-id="witnessNodeId"
        :depth="depthKey"
        :visuals="visuals"
        :page="page"
        :margins="margins"
        :hyphenation="hyphenation"
        :running-titles="runningTitles"
        :book-title="bookTitle"
    />
  </div>
</template>

<script setup>
import FolioView from '../editor/FolioView.vue'

defineProps({
  // Nœud témoin à rendre (premier nœud du modèle relevé sélectionné).
  witnessNodeId: { type: String, default: null },
  depthKey: { type: Number, default: 0 },
  data: { type: Object, default: null },
  visuals: { type: Object, default: null },
  page: { type: Object, default: null },
  margins: { type: Object, default: null },
  hyphenation: { type: Object, default: null },
  runningTitles: { type: Object, default: null },
  bookTitle: { type: String, default: '' },
})
</script>

<style scoped>
/* Colonne flex : le FolioView double-page prend toute la hauteur (flex:1 via
   .folio-view--spread). */
.maq-chap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}


.models-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}

.models-label {
  font-size: var(--fs-sm);
  font-weight: 600;
}

.models-meta {
  font-size: var(--fs-xs);
  opacity: var(--op-faint);
}

.models-empty {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.model-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.model {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4em;
  padding: 0.15em 0.55em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  font: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
  transition: border-color 0.1s ease, background 0.1s ease;
}

.model:hover {
  border-color: var(--c-accent);
}

.model--active {
  border-color: var(--c-accent);
  background: var(--c-accent-soft, var(--c-surface));
  box-shadow: inset 0 0 0 1px var(--c-accent);
}

.model-sig {
  font-family: var(--font-ui);
}

.model-pct {
  font-variant-numeric: tabular-nums;
  opacity: var(--op-muted);
}
</style>
