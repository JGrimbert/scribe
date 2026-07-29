<template>
  <!-- Vis-à-vis d'un niveau de chapitrage dans l'accordéon : gris typographique
       (greeking) plutôt que vrai texte — le verso est une page courante, le recto
       une OUVERTURE de chapitre (bandeau de titre + descente du corps). La largeur
       du titre décroît avec la profondeur (un sous-niveau porte un titre plus
       court). Aucun mot réel : on ne montre que la silhouette typographique. -->
  <div class="chap-cell">
    <div class="chap-folio is-left">
      <div class="greek">
        <span v-for="(w, i) in versoLines" :key="i" class="greek-line" :style="{ width: w }"></span>
      </div>
    </div>
    <div class="chap-folio is-right">
      <div class="chap-open">
        <span class="chap-title" :style="{ width: titleWidth }"></span>
        <div class="greek greek--drop">
          <span v-for="(w, i) in rectoLines" :key="i" class="greek-line" :style="{ width: w }"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Profondeur du niveau (0/1/2) : pilote la largeur du bandeau de titre.
  depthKey: { type: Number, default: 0 },
})

// Largeurs de lignes pseudo-aléatoires mais STABLES (dérivées de l'index) : une
// page de corps se lit à ses lignes pleines et sa dernière ligne courte.
const WIDTHS = ['100%', '96%', '92%', '98%', '90%', '94%', '88%', '100%', '72%']
const versoLines = WIDTHS
const rectoLines = computed(() => WIDTHS.slice(0, 6))

const titleWidth = computed(() => `${Math.max(34, 62 - props.depthKey * 12)}%`)
</script>

<style scoped>
.chap-cell {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: min(100%, 22em);
}

.chap-folio {
  height: 9em;
  padding: 0.9em 0.8em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  overflow: hidden;
}

/* La reliure : bord intérieur plus marqué (comme MaquetteSpreadCell). */
.is-left { border-right-width: 2px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.is-right { border-left-width: 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; }

.greek {
  display: flex;
  flex-direction: column;
  gap: 0.42em;
}

/* Le corps du recto démarre plus bas : l'ouverture de chapitre respire sous son titre. */
.greek--drop {
  margin-top: 0.9em;
}

.greek-line {
  height: 0.28em;
  border-radius: 1px;
  background: color-mix(in srgb, var(--c-ink2) 26%, transparent);
}

.chap-open {
  display: flex;
  flex-direction: column;
}

/* Bandeau de titre : plus épais et plus sombre qu'une ligne de corps, centré. */
.chap-title {
  align-self: center;
  height: 0.5em;
  margin-bottom: 0.2em;
  border-radius: 2px;
  background: color-mix(in srgb, var(--c-ink2) 52%, transparent);
}
</style>
