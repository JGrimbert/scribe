<template>
  <div class="registry-view">
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
        </tr>
      </thead>
      <tbody>
        <tr
            v-for="doc in documents"
            :key="doc.id"
            class="registry-row"
            @click="$emit('select', doc.id)"
        >
          <td>{{ doc.title }}</td>
          <td>{{ doc.totalAxes }}</td>
          <td>{{ doc.totalBlocs }}</td>
          <td>{{ doc.totalArticles }}</td>
          <td>{{ doc.totalMots.toLocaleString('fr') }}</td>
          <td>{{ doc.totalCaracteres.toLocaleString('fr') }}</td>
          <td>{{ formatDate(doc.importedAt) }}</td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!loading" class="empty">Aucun document importé pour l'instant.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['select'])

const documents = ref([])
const loading = ref(false)
const uploading = ref(false)
const error = ref(null)

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
    const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.message || `HTTP ${res.status}`)
    }
    await fetchDocuments()
  } catch (e) {
    error.value = `Échec de l'import : ${e.message}`
  } finally {
    uploading.value = false
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

.error {
  color: #b91c1c;
}

.empty {
  opacity: 0.6;
}
</style>
