<template>
  <!-- Vis-à-vis « nu » : deux folios se rejoignant au centre (livre ouvert), sans
       contenu — cellule par défaut d'une source pas encore câblée. -->
  <div class="maq-spread">
    <div class="maq-folio is-left"></div>
    <div class="maq-folio is-right"></div>
  </div>
</template>

<style scoped>
.maq-spread {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: min(100%, 22em);
}

.maq-folio {
  height: 9em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
}

/* La reliure : le bord intérieur (droite du verso, gauche du recto) plus marqué. */
.is-left { border-right-width: 2px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.is-right { border-left-width: 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; }
</style>
