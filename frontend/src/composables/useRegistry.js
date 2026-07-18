import { ref } from 'vue'

// État de MODULE, pas d'instance : l'accueil et l'aside montrent la même liste,
// et le bouton d'import est monté aux deux endroits. Deux copies divergeraient
// dès le premier import (celui qui n'a pas déclenché l'upload garderait sa
// liste d'avant).
const documents = ref([])
const loading = ref(false)
const uploading = ref(false)
const deletingId = ref(null)
const error = ref(null)

// Le preview d'import vit ici et non dans l'URL : il porte l'outline complet
// (des milliers d'entrées sur un manuscrit réel). De toute façon le backend ne
// garde le buffer qu'en mémoire — un rechargement de /import le perd, d'où la
// garde de route qui renvoie à l'accueil plutôt que d'afficher un écran mort.
const pendingPreview = ref(null)

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

// Pour les consommateurs qui ont besoin de la liste sans être celui qui la
// charge (l'écran de config lit les stats du document courant dedans). Le
// `loading` étant posé avant tout await, deux appels dans le même tick ne font
// qu'un seul fetch.
function ensureLoaded() {
  if (!documents.value.length && !loading.value) return fetchDocuments()
}

// Rend true si le preview est prêt — l'appelant navigue alors vers /import.
async function createPreview(file) {
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
    return true
  } catch (e) {
    error.value = `Échec de l'import : ${e.message}`
    return false
  } finally {
    uploading.value = false
  }
}

async function deleteDocument(id) {
  deletingId.value = id
  error.value = null
  try {
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await fetchDocuments()
    return true
  } catch (e) {
    error.value = `Échec de la suppression : ${e.message}`
    return false
  } finally {
    deletingId.value = null
  }
}

// La confirmation vit ici et non dans les vues : la suppression est offerte à
// deux endroits (la ligne du registre, l'écran de config) et deux formulations
// du même avertissement finiraient par diverger — ou par en oublier une.
async function confirmAndDelete(doc) {
  if (!window.confirm(`Supprimer définitivement « ${doc.title} » ? Cette action est irréversible.`)) return false
  return deleteDocument(doc.id)
}

// Tâche de fond, erreur avalée : l'analyse se relance à la main depuis le
// dashboard, son échec ne doit pas retenir l'affichage du document importé.
function startAnalyse(id) {
  fetch(`/api/documents/${id}/analyse`, { method: 'POST' }).catch(() => {})
}

export function useRegistry() {
  return {
    documents,
    loading,
    uploading,
    deletingId,
    error,
    pendingPreview,
    fetchDocuments,
    ensureLoaded,
    createPreview,
    deleteDocument,
    confirmAndDelete,
    startAnalyse,
  }
}
