<template>
  <!-- Recalibration : le chrome vient de `UiModal` (voile, panneau, bandeau) ;
       ici, seul le contenu métier — l'attente, l'échec, la calibration.
       `open` est DISTINCT de `preview` : la modale s'ouvre d'abord et attend son
       contenu dedans. `topBars=2` : on est dans un document, deux barres à
       dégager (topbar + doc-bar). -->
  <UiModal
      :open="open"
      title="Redéfinir les bornes"
      :hint="HINT"
      :top-bars="2"
      @close="$emit('close')"
  >
    <p v-if="starting" class="recal-wait">
      <i class="pi pi-spin pi-spinner"></i> Relecture du fichier d'origine…
    </p>

    <UiNote v-else-if="recalError" variant="error" class="recal-fail">{{ recalError }}</UiNote>

    <ImportCalibration
        v-else-if="preview"
        mode="recalibration"
        :preview-id="preview.previewId"
        :outline="preview.outline"
        :suggested-structure-start-index="preview.suggestedStructureStartIndex"
        :suggested-structure-end-index="preview.suggestedStructureEndIndex ?? null"
        :current-structure-start-index="shiftedStartIndex"
        :current-structure-end-index="preview.currentStructureEndIndex ?? null"
        @committed="$emit('committed', $event)"
        @cancel="$emit('close')"
    />
  </UiModal>
</template>

<script setup>
import UiModal from '../ui/molecules/UiModal.vue'
import UiNote from '../ui/molecules/UiNote.vue'
import ImportCalibration from '../import/ImportCalibration.vue'

const HINT =
    "Posez le début du contenu (ce qui précède part en liminaire) et, s'il y en a une, la partie finale — table des matières, index, glossaire. Dépliez un titre pour voir ses sous-titres."

defineProps({
  open: { type: Boolean, default: false },
  starting: { type: Boolean, default: false },
  recalError: { type: String, default: null },
  preview: { type: Object, default: null },
  shiftedStartIndex: { type: Number, default: null },
})

defineEmits(['close', 'committed'])
</script>

<style scoped>
/* Attente et échec : centrés dans la place que prendra la calibration, pour que
   le panneau ne saute pas de composition quand elle arrive. Le fond translucide
   et le padding sont portés par le corps de `UiModal` ; ici, seul le
   remplissage flexible + le centrage. */
.recal-wait,
.recal-fail {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}
</style>
