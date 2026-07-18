<template>
  <div class="doc-list">
    <UiNote v-if="error" variant="error">{{ error }}</UiNote>

    <ul v-if="documents.length" class="doc-list__items">
      <!-- Deux boutons FRÈRES, pas imbriqués : la poubelle dans le bouton de
           sélection serait un bouton dans un bouton (HTML invalide, et le clic
           remonterait au parent). Poubelle à DROITE, révélée au survol. -->
      <li
          v-for="doc in documents"
          :key="doc.id"
          class="doc-list__item"
          :class="{ 'doc-list__item--active': doc.id === activeId }"
      >
        <button class="doc" type="button" @click="$emit('select', doc.id)">
          <span class="doc__title">{{ doc.title }}</span>
          <span class="doc__meta">
            {{ formatDay(doc.importedAt) }}
            <template v-if="doc.hasSource"> · {{ formatBytes(doc.sourceSizeBytes) }}</template>
          </span>
        </button>

        <button
            class="doc__delete"
            type="button"
            :title="`Supprimer « ${doc.title} »`"
            :disabled="deletingId === doc.id"
            @click="onDelete(doc)"
        >
          <i class="pi" :class="deletingId === doc.id ? 'pi-spin pi-spinner' : 'pi-trash'"></i>
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
import { formatBytes, formatDay } from '../script/format'

defineProps({
  // Document étudié — souligné dans la liste. Absent sur l'accueil.
  activeId: { type: String, default: null },
})

const emit = defineEmits(['select', 'deleted'])

const { documents, loading, error, deletingId, ensureLoaded, confirmAndDelete } = useRegistry()

// La liste supprime et le dit ; elle ne décide pas de la suite. Supprimer le
// document qu'on est en train d'étudier doit faire quitter l'écran, mais c'est
// au parent de savoir sur quel écran il est.
async function onDelete(doc) {
  if (await confirmAndDelete(doc)) emit('deleted', doc.id)
}

// Le fetch est ici et non chez les parents : la liste est montée à deux
// endroits (accueil, aside), et câbler le chargement dans chacun d'eux, c'est
// l'oublier au troisième. L'état étant de module, deux montages simultanés
// partagent la même réponse.
onMounted(ensureLoaded)
</script>

<style scoped>
.doc-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.doc-list__item {
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);
}

.doc-list__item:hover {
  background: var(--c-hover);
}

.doc-list__item--active {
  background: var(--c-hover);
  font-weight: 600;
}

/* Absente au repos, révélée au survol de la ligne : une colonne de poubelles
   ferait de la suppression l'objet de la liste. Rouge seulement quand on la
   vise. Reste visible pendant la suppression (spinner) et au focus clavier. */
.doc__delete {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: var(--sp-2);
  border: 0;
  background: none;
  color: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s ease;
}

.doc-list__item:hover .doc__delete,
.doc__delete:focus-visible,
.doc__delete:disabled {
  opacity: var(--op-faint);
}

.doc__delete:hover:not(:disabled),
.doc__delete:focus-visible {
  opacity: 1;
  color: var(--c-danger);
}

.doc__delete:disabled {
  cursor: wait;
}

.doc {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1em;
  padding: var(--sp-2) var(--sp-1) var(--sp-2) var(--sp-3);
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.doc__title {
  font-size: var(--fs-md);
  /* Un titre de manuscrit peut être long ; il se coupe plutôt que d'élargir
     l'aside, dont la largeur est fixe. */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc__meta {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  font-weight: 400;
}
</style>
