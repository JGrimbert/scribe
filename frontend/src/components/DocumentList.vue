<template>
  <div class="doc-list">
    <UiNote v-if="error" variant="error">{{ error }}</UiNote>

    <ul v-if="documents.length" class="doc-list__items">
      <li v-for="doc in documents" :key="doc.id" class="doc-list__item">
        <button
            class="doc"
            :class="{ 'doc--active': doc.id === activeId }"
            type="button"
            @click="$emit('select', doc.id)"
        >
          <span class="doc__title">{{ doc.title }}</span>
          <span class="doc__date">{{ formatDate(doc.importedAt) }}</span>
        </button>
      </li>
    </ul>

    <UiNote v-else-if="!loading" variant="hint">Aucun document importé pour l'instant.</UiNote>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import UiNote from './ui/UiNote.vue'
import { useRegistry } from '../composables/useRegistry'

defineProps({
  // Document étudié — souligné dans la liste. Absent sur l'accueil.
  activeId: { type: String, default: null },
})

defineEmits(['select'])

const { documents, loading, error, fetchDocuments } = useRegistry()

// Le fetch est ici et non chez les parents : la liste est montée à deux
// endroits (accueil, aside), et câbler le chargement dans chacun d'eux, c'est
// l'oublier au troisième. L'état étant de module, deux montages simultanés
// partagent la même réponse.
onMounted(() => {
  if (!loading.value) fetchDocuments()
})

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<style scoped>
.doc-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.doc {
  display: flex;
  flex-direction: column;
  gap: 0.1em;
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.doc:hover {
  background: var(--c-hover);
}

.doc--active {
  background: var(--c-hover);
  font-weight: 600;
}

.doc__title {
  font-size: var(--fs-md);
  /* Un titre de manuscrit peut être long ; il se coupe plutôt que d'élargir
     l'aside, dont la largeur est fixe. */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc__date {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  font-weight: 400;
}
</style>
