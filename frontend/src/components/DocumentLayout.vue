<template>
  <template v-if="trame && data">
    <StructureView
        :axeCurrent="axeCurrent"
        :structure="structure"
        @openBloc="openedBloc = $event"
    />

    <router-view />

    <BlocModal
        v-if="openedBloc"
        :openedBloc="openedBloc"
        @close="openedBloc = null"
    />
  </template>

  <p v-else class="loading">Chargement du document…</p>
</template>

<script setup>
import { ref, provide, watch } from 'vue'
import { useRoute } from 'vue-router'
import StructureView from './StructureView.vue'
import BlocModal from './BlocModal.vue'

const route = useRoute()

// StructureView attend encore l'ancien format `structure` (jamais peuplé
// depuis le registre backend, cf. frontend/CLAUDE.md) — reste cassé/masqué
// tant que le menu latéral n'est pas réanimé sur trame/data.
const structure = ref(null)
const axeCurrent = ref(null)

const trame = ref(null)
const data = ref(null)
const openedBloc = ref(null)

provide('documentTrame', trame)
provide('documentData', data)

async function loadDocument(id) {
  trame.value = null
  data.value = null
  const res = await fetch(`/api/documents/${id}`)
  if (!res.ok) {
    alert(`Impossible de charger le document (HTTP ${res.status})`)
    return
  }
  const content = await res.json()
  trame.value = content.trame
  data.value = content.data
}

watch(
    () => route.params.id,
    (id) => { if (id) loadDocument(id) },
    { immediate: true },
)
</script>

<style scoped>
.loading {
  padding: 1.5em;
  opacity: 0.6;
}
</style>
