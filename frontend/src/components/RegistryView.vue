<template>
  <div class="registry-view">
    <template v-if="pendingPreview">
      <ImportCalibration
          :preview-id="pendingPreview.previewId"
          :outline="pendingPreview.outline"
          :suggested-structure-start-index="pendingPreview.suggestedStructureStartIndex"
          @committed="onImportCommitted"
          @cancel="pendingPreview = null"
      />
    </template>

    <template v-else>
      <div class="registry-header">
        <h2>Registre des documents</h2>
        <BaseButton as="label" variant="solid" :busy="uploading">
          {{ uploading ? 'Import en cours…' : 'Importer un .odt' }}
          <input type="file" accept=".odt" hidden :disabled="uploading" @change="onFileChange" />
        </BaseButton>
      </div>

      <UiNote v-if="error" variant="error">{{ error }}</UiNote>

      <UiTable v-if="documents.length">
        <thead>
          <tr>
            <th>Titre</th>
            <th class="num">Axes</th>
            <th class="num">Blocs</th>
            <th class="num">Articles</th>
            <th class="num">Mots</th>
            <th class="num">Caractères</th>
            <th>Importé le</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
              v-for="doc in documents"
              :key="doc.id"
              class="row-link"
              @click="router.push(`/documents/${doc.id}`)"
          >
            <td>{{ doc.title }}</td>
            <td class="num">{{ doc.totalAxes }}</td>
            <td class="num">{{ doc.totalBlocs }}</td>
            <td class="num">{{ doc.totalArticles }}</td>
            <td class="num">{{ doc.totalMots.toLocaleString('fr') }}</td>
            <td class="num">{{ doc.totalCaracteres.toLocaleString('fr') }}</td>
            <td>{{ formatDate(doc.importedAt) }}</td>
            <td class="row-actions">
              <BaseButton
                  variant="ghost"
                  icon="pi-trash"
                  class="delete-btn"
                  title="Supprimer ce document"
                  :busy="deletingId === doc.id"
                  @click.stop="onDelete(doc)"
              />
            </td>
          </tr>
        </tbody>
      </UiTable>

      <UiNote v-else-if="!loading">Aucun document importé pour l'instant.</UiNote>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from './ui/BaseButton.vue'
import UiNote from './ui/UiNote.vue'
import UiTable from './ui/UiTable.vue'
import ImportCalibration from './ImportCalibration.vue'

const router = useRouter()

const documents = ref([])
const loading = ref(false)
const uploading = ref(false)
const error = ref(null)
const pendingPreview = ref(null)
const deletingId = ref(null)

async function fetchDocuments() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch('/api/documents')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    documents.value = await res.json()
  } catch (e) {
    error.value = `Impossible de charger le registre : ${e.message}`
  } finally {
    loading.value = false
  }
}

async function onFileChange(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return

  uploading.value = true
  error.value = null
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/documents/preview', { method: 'POST', body: formData })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.message || `HTTP ${res.status}`)
    }
    pendingPreview.value = await res.json()
  } catch (e) {
    error.value = `Échec de l'import : ${e.message}`
  } finally {
    uploading.value = false
  }
}

async function onImportCommitted(summary) {
  pendingPreview.value = null
  await fetchDocuments()
  // Tâche de fond : ne bloque pas l'affichage du registre. Erreur avalée —
  // l'utilisateur peut toujours (re)lancer le calcul manuellement depuis
  // l'onglet Analyse (cf. plan "Analyse sémantique").
  fetch(`/api/documents/${summary.id}/analyse`, { method: 'POST' }).catch(() => {})
}

async function onDelete(doc) {
  if (!window.confirm(`Supprimer définitivement « ${doc.title} » ? Cette action est irréversible.`)) return

  deletingId.value = doc.id
  error.value = null
  try {
    const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await fetchDocuments()
  } catch (e) {
    error.value = `Échec de la suppression : ${e.message}`
  } finally {
    deletingId.value = null
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('fr')
}

onMounted(fetchDocuments)
</script>

<style scoped>
.registry-view {
  padding: 1.5em;
  max-width: 80ch;
  margin: 0 auto;
  width: 100%;
}

.registry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5em;
}

.row-actions {
  text-align: right;
}

.delete-btn:hover {
  color: var(--c-danger);
}
</style>
