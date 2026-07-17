<template>
  <BaseButton as="label" variant="solid" :busy="uploading">
    {{ uploading ? 'Import en cours…' : 'Importer un .odt' }}
    <input type="file" accept=".odt" hidden :disabled="uploading" @change="onFileChange" />
  </BaseButton>
</template>

<script setup>
import { useRouter } from 'vue-router'
import BaseButton from './ui/BaseButton.vue'
import { useRegistry } from '../composables/useRegistry'

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
