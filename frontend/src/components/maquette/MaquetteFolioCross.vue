<template>
  <!-- Croix de transition : pendant une bascule de vue, les pages s'estompent et
       laissent, à LEUR place, une croix par empagement (diagonales reliant les coins
       opposés des gouttières intérieures) — le gabarit vide, le temps que la nouvelle
       planche se pose. Posée en coords FENÊTRE (comme la trame / les scènes), depuis le
       rect de contenu émis par FolioView (spread-geometry). Purement décoratif. -->
  <div class="mfc" :class="{ 'mfc--on': visible }" aria-hidden="true">
    <div v-for="(box, i) in boxes" :key="i" class="mfc-cross" :style="box" />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Pages émises par FolioView (spread-geometry) : on ne garde que leur empagement.
  pages: { type: Array, default: () => [] },
  // Vrai pendant le creux de la bascule (cf. geometryStale) : révèle la croix.
  visible: { type: Boolean, default: false },
})

const boxes = computed(() =>
  (props.pages ?? [])
    .map((p) => p?.content)
    .filter(Boolean)
    .map((c) => ({
      left: `${c.left}px`,
      top: `${c.top}px`,
      width: `${c.width}px`,
      height: `${c.height}px`,
    })),
)
</script>

<style scoped>
/* Conteneur inerte, plein écran : chaque croix est ferrée en `fixed` sur son
   empagement. Fondu croisé avec les pages (mêmes 160 ms). */
.mfc {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 160ms ease;
}

.mfc--on {
  opacity: 1;
}

/* Deux diagonales de 1 px, coin à coin (même tracé que la croix du gabarit Format,
   cf. BODY_CROSS de folioStyles) — filet discret sur la trame. */
.mfc-cross {
  position: fixed;
  --mfc-line: color-mix(in srgb, var(--c-ink) 16%, transparent);
  background-image:
    linear-gradient(to top right, transparent calc(50% - 0.5px), var(--mfc-line) calc(50% - 0.5px), var(--mfc-line) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
    linear-gradient(to bottom right, transparent calc(50% - 0.5px), var(--mfc-line) calc(50% - 0.5px), var(--mfc-line) calc(50% + 0.5px), transparent calc(50% + 0.5px));
}
</style>
