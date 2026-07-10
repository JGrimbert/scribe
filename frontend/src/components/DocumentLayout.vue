<template>
  <template v-if="trame && data">
    <StructureView
        :trame="trame"
        :data="data"
        :axe-id="route.params.axeId"
        @openNode="openedNode = $event"
    />

    <router-view />

    <BlocModal
        v-if="openedNode"
        :node="openedNode"
        @close="openedNode = null"
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

const trame = ref(null)
const data = ref(null)
const openedNode = ref(null)

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
