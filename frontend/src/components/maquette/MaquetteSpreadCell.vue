<template>
  <!-- Vis-à-vis « nu » : deux folios se rejoignant au centre (livre ouvert), sans
       contenu — cellule par défaut d'une source pas encore câblée. Remplit la
       hauteur du cran, largeur des faces au ratio de la page effective. -->
  <div class="maq-spread" :style="{ '--maq-ratio': ratio }">
    <div class="maq-folio is-left"></div>
    <div class="maq-folio is-right"></div>
  </div>
</template>

<script setup>
defineProps({
  // Ratio largeur/hauteur d'une page (défaut A5 portrait).
  ratio: { type: Number, default: 148 / 210 },
})
</script>

<style scoped>
.maq-spread {
  display: flex;
  gap: 2px;
  height: 100%;
  justify-content: center;
}

.maq-folio {
  flex: 0 0 auto;
  height: 100%;
  aspect-ratio: var(--maq-ratio, 0.7);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
}

/* La reliure : le bord intérieur (droite du verso, gauche du recto) plus marqué. */
.is-left { border-right-width: 2px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.is-right { border-left-width: 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; }
</style>
