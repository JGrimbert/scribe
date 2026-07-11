<template>
  <div class="app">
    <div class="menu">
      <h1>SCRIBE</h1>
      <div class="menu-actions">
        <button
            type="button"
            class="menu-toggle"
            :class="{ 'menu-toggle--active': route.name === 'registry' }"
            title="Registre des documents"
            @click="router.push('/')"
        >
          <i class="pi pi-book"></i>
        </button>
        <button
            v-if="lastDocumentId"
            type="button"
            class="menu-toggle"
            :class="{ 'menu-toggle--active': route.name === 'document' }"
            title="Analyse"
            @click="router.push(`/documents/${lastDocumentId}`)"
        >
          <i class="pi pi-chart-bar"></i>
        </button>
        <button
            v-if="lastDocumentPath"
            type="button"
            class="menu-toggle"
            :class="{ 'menu-toggle--active': isDocumentRoute }"
            title="Éditeur"
            @click="router.push(lastDocumentPath)"
        >
          <i class="pi pi-file-edit"></i>
        </button>
        <button
            type="button"
            class="menu-toggle"
            :class="{ 'menu-toggle--active': quillVisible }"
            :title="quillVisible ? 'Masquer la fenêtre Quill' : 'Afficher la fenêtre Quill'"
            @click="quillVisible = !quillVisible"
        >
          <i class="pi pi-eye"></i>
        </button>
        <i class="pi pi-cog"></i>
      </div>
    </div>

    <router-view />
  </div>
</template>

<script setup>
import { ref, computed, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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

.menu-toggle {
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  padding: 0.2em;
  line-height: 1;
}

.menu-toggle:hover {
  opacity: 0.85;
}

.menu-toggle--active {
  opacity: 1;
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