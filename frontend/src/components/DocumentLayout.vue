<template>
  <template v-if="trame && data">
    <div class="document-layout">
      <StructureView
          :trame="trame"
          :data="data"
          :node-id="route.params.nodeId"
      />

      <div class="document-layout__content">
        <router-view />
      </div>
    </div>
  </template>

  <p v-else class="loading">Chargement du document…</p>
</template>

<script setup>
import { ref, provide, watch } from 'vue'
import { useRoute } from 'vue-router'
import StructureView from './StructureView.vue'

const route = useRoute()

const trame = ref(null)
const data = ref(null)

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

.document-layout {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.document-layout__content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
</style>
