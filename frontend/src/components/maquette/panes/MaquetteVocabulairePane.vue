<template>
  <!-- Jalon de tête « titredulivre » (vocabulaire / recherche). La scène d'analyse
       (nuage / cards, en regard des lambeaux) vit désormais dans la COQUILLE
       (`MaquetteAnalyseScene`, montée par MaquetteView) pour survivre au routeur et
       glisser avec la planche. Ce pane ne garde que le pager des résultats. -->
  <div v-if="searchLayout && resultPageCount > 1" class="maq-pager">
    <button
        type="button" class="maq-pager__btn" aria-label="Résultats précédents"
        :disabled="resultPage === 0" @click="stepResultPage(-1)"
    >
      <i class="pi pi-chevron-left"></i>
    </button>
    <span class="maq-pager__count">{{ resultPage + 1 }} / {{ resultPageCount }}</span>
    <button
        type="button" class="maq-pager__btn" aria-label="Résultats suivants"
        :disabled="resultPage >= resultPageCount - 1" @click="stepResultPage(1)"
    >
      <i class="pi pi-chevron-right"></i>
    </button>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const { searchLayout, resultPage, resultPageCount, stepResultPage } = inject('maq')
</script>

<style scoped>
/* Pager des résultats : discret, au pied de la planche. POSÉ SUR elle (pas dans le
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
