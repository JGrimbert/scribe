<template>
  <!-- Rapport de recalibrage : carte flottante en tête de l'aperçu (pas de toast —
       une relecture perdue doit pouvoir se lire et se refaire). Fermable. -->
  <div v-if="report" class="maq-recal-report">
    <UiCallout :tone="report.droppedValidations.length ? 'error' : 'info'" title="Recalibré">
      {{ report.restoredValidations }} validation(s) reposée(s)<template
          v-if="report.droppedValidations.length"
      >, {{ report.droppedValidations.length }} perdue(s) — à relire :
        <span class="maq-recal-report__dropped">
          {{ report.droppedValidations.map((d) => `${d.slug} (${d.reason})`).join(', ') }}
        </span></template><template v-else>, aucune perdue.</template>
    </UiCallout>
    <button type="button" class="maq-recal-report__close" title="Fermer" @click="$emit('close')">
      <i class="pi pi-times" aria-hidden="true"></i>
    </button>
  </div>
</template>

<script setup>
import UiCallout from '../ui/atoms/UiCallout.vue'

defineProps({ report: { type: Object, default: null } })
defineEmits(['close'])
</script>

<style scoped>
/* Carte flottante centrée en tête de l'écran, sous les deux barres. Au-dessus de
   l'aperçu et du sommaire, sous les modales (z 175). `--maq-gutter` hérité de
   `.maquette`. */
.maq-recal-report {
  position: fixed;
  top: calc(2 * var(--bar-size) + 0.75em);
  left: calc(var(--maq-gutter) + (100% - var(--maq-gutter)) / 2);
  transform: translateX(-50%);
  z-index: 175;
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  width: min(46em, 60%);
}

.maq-recal-report__dropped {
  font-family: var(--font-ui);
  font-weight: 600;
}

.maq-recal-report__close {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.7em;
  height: 1.7em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  color: var(--c-ink2);
  cursor: pointer;
}

.maq-recal-report__close:hover {
  color: var(--c-danger);
}
</style>
