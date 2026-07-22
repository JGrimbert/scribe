<template>
  <!-- L'icône est portée en permanence, et pas seulement en rail : c'est elle
       qui reste quand le libellé tombe (aside repliée), sinon le bouton se
       réduit à un rectangle vide. -->
  <BaseButton
      as="label"
      variant="solid"
      icon="pi-upload"
      :busy="uploading"
      :title="label || 'Importer un document'"
      :class="{ 'import-btn--block': block }"
  >
    {{ uploading ? 'Import en cours…' : label }}
    <input type="file" accept=".odt" hidden :disabled="uploading" @change="onFileChange" />
  </BaseButton>
</template>

<script setup>
import { useRouter } from 'vue-router'
import BaseButton from '../ui/BaseButton.vue'
import { useRegistry } from '../../composables/useRegistry'

defineProps({
  // L'accueil parle du format (« un .odt » : on choisit un fichier), l'aside du
  // geste (« un document » : on enrichit le registre).
  label: { type: String, default: 'Importer un .odt' },
  // Pied d'aside : le bouton occupe toute la largeur de la colonne.
  block: { type: Boolean, default: false },
})

const router = useRouter()
const { uploading, createPreview } = useRegistry()

// L'échec est porté par `error` du registre, affiché par le parent (accueil ou
// aside) : c'est là qu'il se lit, à côté de la liste qu'il n'a pas alimentée.
async function onFileChange(e) {
  const file = e.target.files[0]
  // Vidé avant tout await : sans ça, réimporter le MÊME fichier ne déclenche
  // aucun `change` (valeur inchangée pour l'input).
  e.target.value = ''
  if (!file) return
  if (await createPreview(file)) router.push('/import')
}
</script>

<style scoped>
.import-btn--block {
  width: 100%;
  justify-content: center;
}
</style>
