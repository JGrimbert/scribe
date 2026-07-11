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
        <label class="upload" :class="{ 'upload--busy': uploading }">
          {{ uploading ? 'Import en cours…' : 'Importer un .odt' }}
          <input type="file" accept=".odt" hidden :disabled="uploading" @change="onFileChange" />
        </label>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <table v-if="documents.length" class="registry-table">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Axes</th>
            <th>Blocs</th>
            <th>Articles</th>
            <th>Mots</th>
            <th>Caractères</th>
            <th>Importé le</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
              v-for="doc in documents"
              :key="doc.id"
              class="registry-row"
              @click="router.push(`/documents/${doc.id}`)"
          >
            <td>{{ doc.title }}</td>
            <td>{{ doc.totalAxes }}</td>
            <td>{{ doc.totalBlocs }}</td>
            <td>{{ doc.totalArticles }}</td>
            <td>{{ doc.totalMots.toLocaleString('fr') }}</td>
            <td>{{ doc.totalCaracteres.toLocaleString('fr') }}</td>
            <td>{{ formatDate(doc.importedAt) }}</td>
            <td class="registry-row__actions">
              <button
                  type="button"
                  class="delete-btn"
                  title="Supprimer ce document"
                  :disabled="deletingId === doc.id"
                  @click.stop="onDelete(doc)"
              >
                <i class="pi pi-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else-if="!loading" class="empty">Aucun document importé pour l'instant.</p>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
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

async function onImportCommitted() {
  pendingPreview.value = null
  await fetchDocuments()
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

.upload {
  font-size: 0.85em;
  padding: 0.5rem 1rem;
  background: var(--c-accent);
  color: white;
  border-radius: 6px;
  cursor: pointer;
}

.upload--busy {
  opacity: 0.6;
  cursor: wait;
}

.registry-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.registry-table th,
.registry-table td {
  text-align: left;
  padding: 0.5em 0.75em;
  border-bottom: 1px solid var(--c-border, #e0d8cc);
}

.registry-row {
  cursor: pointer;
}

.registry-row:hover {
  background: var(--c-surface4, rgba(0, 0, 0, 0.04));
}

.registry-row__actions {
  text-align: right;
}

.delete-btn {
  border: none;
  background: none;
  cursor: pointer;
  opacity: 0.5;
  padding: 0.25em;
  font-size: 0.95em;
  color: inherit;
}

.delete-btn:hover {
  opacity: 1;
  color: #b91c1c;
}

.delete-btn:disabled {
  opacity: 0.3;
  cursor: wait;
}

.error {
  color: #b91c1c;
}

.empty {
  opacity: 0.6;
}
</style>
