<template>
  <div class="app">
    <div class="menu">
      <h1>SCRIBE</h1>
      <div><i class="pi pi-cog"></i></div>
    </div>
    <StructureView
        :axeCurrent="axeCurrent"
        :structure="structure"
        @openBloc="openedBloc = $event"
        @load="loadJSON"
    />

    <div class="scroll-folio">
      <FolioComposer
          :trame="trame"
          :data="data"
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import StructureView from './components/StructureView.vue'
import BlocModal from './components/BlocModal.vue'
import Scroll from "./components/Scroll.vue";
import FolioComposer from "./components/FolioComposer.vue";

const structure = ref(null)
const trame = ref(null)
const data = ref(null)
const openedBloc = ref(null)

const axeCurrent = ref(2)

onMounted(async () => {
  try {
    const res1 = await fetch('/structure.json')
    const res2 = await fetch('/data.json')
    const res3 = await fetch('/trame.json')
    structure.value = await res1.json()
    data.value = await res2.json()
    trame.value = await res3.json()
  } catch {
    console.warn('structure.json introuvable')
  }
})

function loadJSON(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()

  reader.onload = (ev) => {
    try {
      structure.value = JSON.parse(ev.target.result)
    } catch {
      alert('JSON invalide')
    }
  }

  reader.readAsText(file)
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

}

h1 {
  font-size: 1em;
}

.scroll-folio {
  padding-top: 1.5em;
  padding-left: 1.5em;
  margin: 0 auto;
}

.menu {
  position: sticky;
  color: #FFF;
  font-weight: bold;
  padding: 0.4em;
  display: flex;
  z-index: 1;
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