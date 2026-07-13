<template>
  <div class="app">
    <div class="menu">
      <h1>SCRIBE</h1>
      <div class="menu-actions">
        <BaseButton
            variant="ghost"
            icon="pi-book"
            :active="route.name === 'registry'"
            title="Registre des documents"
            @click="router.push('/')"
        />
        <BaseButton
            v-if="lastDocumentId"
            variant="ghost"
            icon="pi-chart-bar"
            :active="route.name === 'document'"
            title="Analyse"
            @click="router.push(`/documents/${lastDocumentId}`)"
        />
        <BaseButton
            v-if="lastDocumentPath"
            variant="ghost"
            icon="pi-file-edit"
            :active="isDocumentRoute"
            title="Éditeur"
            @click="router.push(lastDocumentPath)"
        />
        <BaseButton
            variant="ghost"
            icon="pi-eye"
            :active="quillVisible"
            :title="quillVisible ? 'Masquer la fenêtre Quill' : 'Afficher la fenêtre Quill'"
            @click="quillVisible = !quillVisible"
        />
        <i class="pi pi-cog"></i>
      </div>
    </div>

    <router-view />
  </div>
</template>

<script setup>
import { ref, computed, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from './components/ui/BaseButton.vue'

const route = useRoute()
const router = useRouter()

const quillVisible = ref(false)
provide('quillVisible', quillVisible)

const isDocumentRoute = computed(() => route.matched.some(r => r.name === 'document-layout'))

// Mémorise la dernière route document visitée pour le bouton "Éditeur"
// (équivalent de l'ancien `documentId` : montrer/retrouver le document en cours).
const lastDocumentPath = ref(null)
const lastDocumentId = ref(null)
router.afterEach((to) => {
  if (to.params.id) {
    lastDocumentPath.value = to.fullPath
    lastDocumentId.value = to.params.id
  }
})
</script>

<style>
@import 'primeicons/primeicons.css';
@import "./assets/base.css";
@import "../public/paged.css";

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

h1 {
  font-size: 1em;
}

.scroll-folio {
  width: 100%; /* explicite : une marge auto désactiverait le stretch flex et ferait dépendre
                  la largeur du contenu mis à l'échelle par le JS — boucle de rétroaction avec Folia */
  flex: 1 1 auto;
  min-height: 0; /* sinon un enfant flex refuse de rétrécir sous sa taille de contenu */
  display: flex;
  flex-direction: column;
  padding-top: 1.5em;
  padding-bottom: 1.5em;
  padding-left: 1.5em;

  overflow-x: scroll;
}

.menu {
  flex: 0 0 auto;
  position: sticky;
  top: 0;
  height: var(--bar-size);
  color: #FFF;
  font-weight: bold;
  padding: 0.4em;
  display: flex;
  align-items: center;
  z-index: 1;
}

.menu-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.6em;
}

.menu::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--c-accent);
  opacity: 0.3;
  filter: saturate(2);
  z-index: -1;
}

</style>