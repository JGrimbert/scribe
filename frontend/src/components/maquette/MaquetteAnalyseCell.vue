<template>
  <!-- Feuillet d'une section d'analyse dans la pellicule : UNE page nue (et non un
       vis-à-vis comme les autres cellules — une section d'analyse n'est pas une
       planche du livre, elle n'a pas de reliure), portant le nom de la section.
       Elle ne montre pas l'analyse — c'est la VUE, dans la scène, qui s'en charge ;
       ici on ne fait que désigner. -->
  <div class="an-cell" :style="{ '--maq-ratio': ratio }">
    <div class="an-folio">
      <span class="an-label">{{ label }}</span>
    </div>
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
/* La cellule garde la LARGEUR d'un vis-à-vis (c'est le pas de la pellicule, commun
   à toutes les sources) ; la page s'y centre. */
.an-cell {
  display: flex;
  height: 100%;
  justify-content: center;
}

.an-folio {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  aspect-ratio: var(--maq-ratio, 0.7);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
}

/* Le libellé est le seul contenu de la page : centré dedans, borné à sa largeur. */
.an-label {
  max-width: 90%;
  padding: 0.15em 0.5em;
  text-align: center;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-accent-alt-darker);
}
</style>
