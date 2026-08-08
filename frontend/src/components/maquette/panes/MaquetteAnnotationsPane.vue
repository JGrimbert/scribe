<template>
  <!-- Jalon Annotations (dernier cran) : la scène des fragments ANNOTÉS. Le FolioView
       persistant (dans le shell) coule les passages surlignés en lambeaux (page nue,
       planche glissée à gauche comme la recherche) ; ce pane pose EN REGARD le panneau
       de validation (avancement · seuil · chapitres en attente) et, en tête de la
       colonne de lambeaux, le menu de filtres (ex-« Surlignages »). -->

  <!-- Menu de filtres : en tête de la colonne de lambeaux (bord gauche, la planche
       ayant glissé). Hors flux, hauteur constante — cf. MaquetteAnnotationFilters. -->
  <div v-if="annotationsLayout" class="maq-annot-filters">
    <MaquetteAnnotationFilters
        :items="inventory.highlights"
        :highlights="highlights"
        :muted="mutedColors"
        @toggle="toggleMutedColor"
    />
  </div>

  <!-- Pager : la molette au-dessus du folio fait la même chose sans s'annoncer. -->
  <div v-if="annotationsLayout && resultPageCount > 1" class="maq-pager">
    <button
        type="button" class="maq-pager__btn" aria-label="Annotations précédentes"
        :disabled="resultPage === 0" @click="stepResultPage(-1)"
    >
      <i class="pi pi-chevron-left"></i>
    </button>
    <span class="maq-pager__count">{{ resultPage + 1 }} / {{ resultPageCount }}</span>
    <button
        type="button" class="maq-pager__btn" aria-label="Annotations suivantes"
        :disabled="resultPage >= resultPageCount - 1" @click="stepResultPage(1)"
    >
      <i class="pi pi-chevron-right"></i>
    </button>
  </div>

  <!-- Panneau de validation, en regard des lambeaux (colonne libérée par la planche).
       Fondu simple à l'entrée (la scène n'existe qu'une fois la planche repaginée). -->
  <Transition name="maq-scene-fade">
    <div
        v-if="annotationsLayout"
        class="maq-annot-scene"
        :style="{ left: analyseLeft }"
    >
      <MaquetteAnnotations :rules="rules" :char-counts="annotationCharCounts" />
    </div>
  </Transition>
</template>

<script setup>
import { inject } from 'vue'
import MaquetteAnnotations from '../MaquetteAnnotations.vue'
import MaquetteAnnotationFilters from '../MaquetteAnnotationFilters.vue'

const {
  annotationsLayout, resultPage, resultPageCount, stepResultPage, analyseLeft,
  inventory, highlights, mutedColors, toggleMutedColor, rules, annotationCharCounts,
} = inject('maq')
</script>

<style scoped>
/* Menu de filtres : ancré en haut à gauche de la scène du folio (dans .folio-col),
   au-dessus des lambeaux. La planche a glissé d'un cran, ce bord est libre. */
.maq-annot-filters {
  position: absolute;
  top: 0.4em;
  left: 0;
  z-index: 4;
}

/* Panneau « en regard » : la colonne que la planche libère en glissant. Fixed = calé
   sur le viewport (la pile de barres est comptée), borné au-dessus du dock. Le bord
   gauche suit la géométrie émise (bord droit de la page de lambeaux) ; le droit tient
   une petite marge — pas de colonne de minis ici, contrairement au Vocabulaire. */
.maq-annot-scene {
  position: fixed;
  right: 1em;
  top: calc(4em + var(--bar-size));
  bottom: calc(var(--maq-dock-h) + var(--sp-4));
  z-index: 2;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Fondu d'entrée (enter seulement : à la sortie la scène change de source). */
.maq-scene-fade-enter-active {
  transition: opacity 0.22s ease;
}

.maq-scene-fade-enter-from {
  opacity: 0;
}

/* Pager des lambeaux : discret, au pied de la planche. POSÉ SUR elle (pas dans le
   flux). Racine inerte, seuls les boutons reprennent le pointeur. */
.maq-pager {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding-top: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-muted);
  pointer-events: none;
}

.maq-pager__btn {
  pointer-events: auto;
  display: flex;
  align-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
}

.maq-pager__btn:hover:not(:disabled) {
  color: var(--c-accent-alt);
}

.maq-pager__btn:disabled {
  opacity: var(--op-faint);
  cursor: default;
}

.maq-pager__count {
  font-variant-numeric: tabular-nums;
}
</style>
