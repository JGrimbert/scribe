<template>
  <template v-if="trame && data">
    <DocumentBar
        :title="title"
        :trame="trame"
        :data="data"
        :current-node-id="currentNodeId"
        :sidebar-expanded="sidebarExpanded"
        :scoped="!isEditor"
        @toggle-sidebar="sidebarExpanded = !sidebarExpanded"
        @select="select"
    />

    <div class="document-layout">
      <StructureView
          :trame="trame"
          :data="data"
          :expanded="sidebarExpanded"
          :node-id="currentNodeId"
          @select="select"
      />

      <div class="document-layout__content">
        <router-view />
      </div>
    </div>
  </template>

  <p v-else class="loading">Chargement du document…</p>
</template>

<script setup>
import { ref, computed, provide, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StructureView from './StructureView.vue'
import DocumentBar from './DocumentBar.vue'

const route = useRoute()
const router = useRouter()

const trame = ref(null)
const data = ref(null)
const title = ref('')

provide('documentTrame', trame)
provide('documentData', data)

// ── État du shell (partagé sidebar + fil d'Ariane) ──
const SIDEBAR_KEY = 'scribe.sidebar.expanded'
const sidebarExpanded = ref(localStorage.getItem(SIDEBAR_KEY) !== 'false')
watch(sidebarExpanded, (v) => localStorage.setItem(SIDEBAR_KEY, String(v)))

// Scope de l'analyse (null = livre entier). Posé par un clic sidebar/fil
// d'Ariane en mode analyse ; consommé par le dashboard (câblage seul pour
// l'instant, le recalcul scopé viendra ensuite).
const scopeNodeId = ref(null)
provide('analyseScopeNodeId', scopeNodeId)

const isEditor = computed(() => route.name === 'editor')

// Nœud « courant » : en édition c'est l'article ouvert (URL), en analyse c'est
// le scope choisi. Sert au surlignage sidebar et au fil d'Ariane.
const currentNodeId = computed(() =>
    isEditor.value ? route.params.nodeId : scopeNodeId.value,
)

// Comportement des liens selon l'état : édition → navigation vers l'article ;
// analyse → pose du scope (pas de navigation).
function select(nodeId) {
  if (isEditor.value) {
    router.push(nodeId ? `/documents/${route.params.id}/noeud/${nodeId}` : `/documents/${route.params.id}`)
  } else {
    scopeNodeId.value = nodeId
  }
}

async function loadDocument(id) {
  trame.value = null
  data.value = null
  scopeNodeId.value = null
  const res = await fetch(`/api/documents/${id}`)
  if (!res.ok) {
    alert(`Impossible de charger le document (HTTP ${res.status})`)
    return
  }
  const content = await res.json()
  title.value = content.title ?? ''
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
