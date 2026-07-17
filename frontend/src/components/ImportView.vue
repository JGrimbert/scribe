<template>
  <!-- Plein écran, hors DocumentLayout : il n'y a pas encore de document, donc
       rien à mettre dans une aside. `v-if` par sûreté — la garde de route a
       déjà renvoyé à l'accueil s'il n'y a pas de preview. -->
  <ImportCalibration
      v-if="pendingPreview"
      :preview-id="pendingPreview.previewId"
      :outline="pendingPreview.outline"
      :suggested-structure-start-index="pendingPreview.suggestedStructureStartIndex"
      :suggested-structure-end-index="pendingPreview.suggestedStructureEndIndex ?? null"
      @committed="onCommitted"
      @cancel="cancel"
  />
</template>

<script setup>
import { useRouter } from 'vue-router'
import ImportCalibration from './ImportCalibration.vue'
import { useRegistry } from '../composables/useRegistry'

const router = useRouter()
const { pendingPreview, fetchDocuments, startAnalyse } = useRegistry()

async function onCommitted(summary) {
  pendingPreview.value = null
  await fetchDocuments()
  startAnalyse(summary.id)
  // Le document arrive sur le volet Styles de sa config : ce qu'on vient de
  // calibrer est fait, l'étape suivante est d'arbitrer ses styles.
  router.push({ name: 'config', params: { id: summary.id }, query: { volet: 'styles' } })
}

function cancel() {
  pendingPreview.value = null
  router.push('/')
}
</script>
