<template>
  <div class="app">
    <div class="menu">
      <h1>SCRIBE</h1>
      <div class="menu-actions">
        <button
            type="button"
            class="menu-toggle"
            :class="{ 'menu-toggle--active': currentView === 'registry' }"
            title="Registre des documents"
            @click="currentView = 'registry'"
        >
          <i class="pi pi-book"></i>
        </button>
        <button
            v-if="documentId"
            type="button"
            class="menu-toggle"
            :class="{ 'menu-toggle--active': currentView === 'editor' }"
            title="Éditeur"
            @click="currentView = 'editor'"
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

    <RegistryView
        v-if="currentView === 'registry'"
        @select="onSelectDocument"
    />

    <template v-else>
      <StructureView
          :axeCurrent="axeCurrent"
          :structure="structure"
          @openBloc="openedBloc = $event"
      />

      <div class="scroll-folio">
        <FolioComposer
            :trame="trame"
            :data="data"
            :quill-visible="quillVisible"
        />
        <Scroll
            v-if="false === true"
            :trame="trame"
            :data="data"
            @update="onContenuUpdate"
        />
      </div>
      <BlocModal
          v-if="openedBloc"
          :openedBloc="openedBloc"
          @close="openedBloc = null"
      />
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import StructureView from './components/StructureView.vue'
import BlocModal from './components/BlocModal.vue'
import Scroll from "./components/Scroll.vue";
import FolioComposer from "./components/FolioComposer.vue";
import RegistryView from "./components/RegistryView.vue";

const structure = ref(null)
const trame = ref(null)
const data = ref(null)
const openedBloc = ref(null)
const quillVisible = ref(false)

const axeCurrent = ref(2)

const currentView = ref('registry')
const documentId = ref(null)

async function onSelectDocument(id) {
  const res = await fetch(`/api/documents/${id}`)
  if (!res.ok) {
    alert(`Impossible de charger le document (HTTP ${res.status})`)
    return
  }
  const content = await res.json()
  trame.value = content.trame
  data.value = content.data
  documentId.value = id
  currentView.value = 'editor'
}

function onContenuUpdate() {
  console.log("update")
}
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