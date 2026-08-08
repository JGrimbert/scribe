<template>
  <!-- Sommaire flottant de l'écran Maquette : toujours ouvert, hors flux (il ne
       pousse pas la maquette). Il porte les PARTIES (Format · Liminaire ·
       Chapitrage n°x, = les `series` de l'accordéon) et l'arbre des axes
       (StructureView réutilisé). Le champ de recherche, lui, a quitté cette carte
       pour la troisième barre de l'écran (MaquetteBar). -->
  <div class="maq-nav" >
    <!-- La carte : le sommaire. -->
    <div class="maq-nav__card">
      <!-- Liste d'exploration (Format · Liminaire · Chapitrage n°x). -->
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
      <div class="maq-nav__scroll">
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

    <!-- Pied de la colonne : le dock accordéon de la maquette. Il vit ICI pour
         être ferré au bord gauche de la fenêtre (le sommaire l'est déjà) et
         déborde volontairement la largeur du sommaire — d'où sa largeur propre. -->
    <div class="maq-nav__footer">
      <slot name="footer" />
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
/* Colonne flottante hors flux, calée sous les DEUX barres (doc-bar + barre de la
   maquette, cf. MaquetteBar) : la carte du sommaire en tête, le dock en pied. Le
   conteneur n'a aucun décor propre — `pointer-events:none` dessus, `auto` sur ses
   zones utiles, pour laisser passer les clics autour. */
.maq-nav {
  position: absolute;
  top: calc(2 * var(--bar-size));
  left: 0;
  width: 15em;
  /* Hauteur PLEINE (et non `max-height`) : le pied doit pouvoir se caler en bas
     de la colonne, le sommaire restant en tête. La distance au pied de la fenêtre
     est réduite de moitié (`--sp-4` / 2) — le dock accordéon descend d'autant. */
  height: calc(100% - 2 * var(--bar-size) - var(--sp-4) / 2);
  display: flex;

  flex-direction: column;
  gap: 0;
  /* Au-dessus du reste de la maquette, sous les modales (z 200). */
  z-index: 160;
  pointer-events: none;

  margin: 0 1em;
}

/* Carte flottante (mêmes traits que les contrôles liminaire et les blocs de
   l'aside). Au repos, sa taille s'ajuste au contenu : l'espace vide ne couvre
   pas le folio. */
.maq-nav__card {
  margin-top: 1.1em;
  min-height: 0;
  display: flex;
  /* Colonne : parties en tête, puis l'arbre. */
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
 /* border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-card-float);*/
  backdrop-filter: var(--c-backdrop-filter-blur);
}

/* Pied de colonne (dock accordéon) : poussé en bas (`margin-top: auto`), FERRÉ AU
   BORD GAUCHE de la fenêtre — la marge latérale de la colonne est annulée — et
   plus large qu'elle : la pellicule a besoin de la largeur de la zone principale,
   pas des 15em du sommaire. */
.maq-nav__footer {
  margin-top: auto;
  margin-left: -1em;
  width: 66vw;
  pointer-events: auto;
}

/* Arbre des axes : défile sans barre visible (scrollbar masquée) — pas de chrome. */
.maq-nav__scroll {
  pointer-events: auto;
  flex: 0 1 auto;
  width: 100%;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.maq-nav__scroll::-webkit-scrollbar {
  display: none;
}

.maq-nav__parts {
  flex: 0 0 auto;
  pointer-events: auto;
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
