<template>
  <!-- Modale d'import, montée UNE fois au niveau de l'app : `pendingPreview` est
       un état de module (useRegistry), et l'import se déclenche à deux endroits
       (accueil, aside de config). Une instance unique pilotée par le preview
       sert les deux, sans écran dédié ni route `/import`. -->
  <UiModal
      :open="!!pendingPreview"
      title="Calibrage de l'import"
      :hint="HINT"
      @close="cancel"
  >
    <ImportCalibration
        v-if="pendingPreview"
        mode="import"
        :preview-id="pendingPreview.previewId"
        :outline="pendingPreview.outline"
        :suggested-structure-start-index="pendingPreview.suggestedStructureStartIndex"
        :suggested-structure-end-index="pendingPreview.suggestedStructureEndIndex ?? null"
        @committed="onCommitted"
        @cancel="cancel"
    />
  </UiModal>
</template>

<script setup>
import { useRouter } from 'vue-router'
import UiModal from '../ui/molecules/UiModal.vue'
import ImportCalibration from './ImportCalibration.vue'
import { useRegistry } from '../../composables/useRegistry'

const HINT =
    "Posez le début du contenu (ce qui précède part en liminaire) et, s'il y en a une, la partie finale — table des matières, index, glossaire. Dépliez un titre pour voir ses sous-titres."

const router = useRouter()
const { pendingPreview, fetchDocuments, startAnalyse } = useRegistry()

async function onCommitted(summary) {
  pendingPreview.value = null
  await fetchDocuments()
  startAnalyse(summary.id)
  // Le document arrive sur sa config : ce qu'on vient de calibrer est fait,
  // l'étape suivante est d'arbitrer ses styles.
  router.push({ name: 'config', params: { id: summary.id } })
}

// Annuler ne navigue plus : on reste là où l'import a été lancé (accueil ou aside
// de config), le preview jeté.
function cancel() {
  pendingPreview.value = null
}
</script>
