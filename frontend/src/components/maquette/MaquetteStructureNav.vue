<template>
  <!-- Sommaire flottant de l'écran Maquette : toujours ouvert, hors flux (il ne
       pousse pas la maquette), SANS FOND ni scrollbar visible. Liste unique de
       premier niveau : les PARTIES (Format · Liminaire · Chapitrage n°x, = les
       `series` de l'accordéon) en tête, puis l'arbre des axes (StructureView
       réutilisé). Le cran focusé surligne sa partie ; le nœud témoin son axe. -->
  <div class="maq-nav">
    <div class="maq-nav__scroll">
      <div class="maq-nav__parts">
        <TreeRow
            v-for="part in parts"
            :key="part.key"
            variant="list"
            normalize-case
            :current="part.key === activeSeriesKey"
            @open="$emit('focus-series', part.key)"
        >
          {{ part.label }}
        </TreeRow>
      </div>

      <StructureView
          v-if="trame && data"
          :trame="trame"
          :data="data"
          :node-id="nodeId"
          :expanded="true"
          @select="$emit('select-node', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import StructureView from '../structure/StructureView.vue'
import TreeRow from '../ui/molecules/TreeRow.vue'

defineProps({
  // Parties de l'écran (Format · Liminaire · Chapitrage n°x) : { key, label }.
  parts: { type: Array, default: () => [] },
  // Série du cran focusé — surligne la partie correspondante.
  activeSeriesKey: { type: String, default: null },
  trame: { type: Object, default: null },
  data: { type: Object, default: null },
  // Nœud témoin courant de l'aperçu (surligne son axe dans l'arbre).
  nodeId: { type: String, default: null },
})

defineEmits(['focus-series', 'select-node'])
</script>

<style scoped>
/* Hors flux, cal(é sous la doc-bar. Taille ajustée au contenu (borné par
   max-height) : l'espace vide ne couvre pas le folio. `pointer-events:none` sur
   le conteneur, `auto` sur le scroller, pour laisser passer les clics autour. */
.maq-nav {
  position: absolute;
  top: calc(var(--bar-size) + 1.25em);
  left: 0;
  width: 15em;
  max-height: calc(100% - var(--bar-size) - 1.25em - var(--sp-4));
  display: flex;
  flex-direction: column;
  z-index: 20;
  pointer-events: none;
}

/* Défile sans barre visible (scrollbar masquée) — pas de chrome, « sans fond ». */
.maq-nav__scroll {
  pointer-events: auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.maq-nav__scroll::-webkit-scrollbar {
  display: none;
}

.maq-nav__parts {
  padding: 0 0.6em;
}

/* StructureView est pensé pour la colonne d'aside (fond + décrochement sous la
   barre) ; ici il flotte, sans fond ni décrochement. La classe de scope de
   StructureView est posée SUR `.structure-panel`, d'où le ciblage direct. */
.maq-nav__scroll :deep(.structure-panel) {
  margin-top: 0;
  background: transparent;
}
</style>
