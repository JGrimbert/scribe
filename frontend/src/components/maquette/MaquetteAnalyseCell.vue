<template>
  <!-- Feuillet d'une section d'analyse dans l'accordéon de recherche : un vis-à-vis
       nu au format des autres cellules (même ratio, même reliure), portant le nom
       de la section. Il ne montre pas l'analyse — c'est la VUE, dans la scène, qui
       s'en charge ; ici on ne fait que désigner. -->
  <div class="an-cell" :style="{ '--maq-ratio': ratio }">
    <div class="an-folio is-left"></div>
    <div class="an-folio is-right"></div>
    <span class="an-label">{{ label }}</span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  // Ratio largeur/hauteur d'une page (défaut A5 portrait).
  ratio: { type: Number, default: 148 / 210 },
})
</script>

<style scoped>
.an-cell {
  position: relative;
  display: flex;
  gap: 2px;
  height: 100%;
  justify-content: center;
}

.an-folio {
  flex: 0 0 auto;
  height: 100%;
  aspect-ratio: var(--maq-ratio, 0.7);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
}

/* La reliure : bord intérieur plus marqué (comme MaquetteSpreadCell). */
.is-left { border-right-width: 2px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.is-right { border-left-width: 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; }

/* Le libellé se pose SUR la reliure, centré : la cellule est vide, il en est le
   seul contenu. */
.an-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 90%;
  padding: 0.15em 0.5em;
  text-align: center;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-accent-alt-darker);
  background: var(--c-surface);
  border-radius: var(--radius-sm);
}
</style>
