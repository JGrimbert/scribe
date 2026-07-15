<template>
  <template v-if="trame && data">
    <div class="document-layout-wrapper">
      <DocumentBar
          ref="docBarEl"
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
        <!-- Sidebar avec CustomScrollbar -->
        <div class="document-layout__sidebar">
          <CustomScrollbar :top-offset="42">
            <StructureView
                :trame="trame"
                :data="data"
                :expanded="sidebarExpanded"
                :node-id="currentNodeId"
                @select="select"
            />
          </CustomScrollbar>
        </div>

        <!-- Contenu principal avec CustomScrollbar -->
        <div class="document-layout__content">
          <CustomScrollbar :top-offset="42">
            <router-view />
          </CustomScrollbar>
        </div>
      </div>
    </div>
  </template>
  <p v-else class="loading">Chargement du document...</p>
</template>

<script setup>
import { ref, computed, provide, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StructureView from './StructureView.vue'
import DocumentBar from './DocumentBar.vue'
import CustomScrollbar from './CustomScrollbar.vue'
import { provideAnalyse } from '../composables/useAnalyse'

const route = useRoute()
const router = useRouter()

// Store d'analyse fourni ici (et non dans AnalyseView) : DocumentBar, monté
// au-dessus du <router-view>, doit pouvoir le consommer pour la checklist.
provideAnalyse()

const trame = ref(null)
const data = ref(null)
const title = ref('')

const docBarEl = ref(null)
const menuEl = ref(null)
const docBarHeight = ref(0)
const menuHeight = ref(0)

provide('documentTrame', trame)
provide('documentData', data)

// tat du shell (partagé sidebar + fil d'Ariane) 
const SIDEBAR_KEY = 'scribe.sidebar.expanded'
const sidebarExpanded = ref(localStorage.getItem(SIDEBAR_KEY) !== 'false')
watch(sidebarExpanded, (v) => localStorage.setItem(SIDEBAR_KEY, String(v)))

// Scope de l'analyse (null = livre entier). Posé par un clic sidebar/fil
// d'Ariane en mode analyse ; consommé par le dashboard (câblage seul pour
// l'instant, le recalcul scopé viendra ensuite).
const scopeNodeId = ref(null)
provide('analyseScopeNodeId', scopeNodeId)

const isEditor = computed(() => route.name === 'editor')

// Nud « courant » : en dition c'est l'article ouvert (URL), en analyse c'est
// le scope choisi. Sert au surlignage sidebar et au fil d'Ariane.
const currentNodeId = computed(() =>
    isEditor.value ? route.params.nodeId : scopeNodeId.value,
)

// Comportement des liens selon l'tat : dition  navigation vers l'article ;
// analyse  pose du scope (pas de navigation).
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

onMounted(() => {
  nextTick(() => {
    if (docBarEl.value) docBarHeight.value = docBarEl.value.offsetHeight
    if (menuEl.value) menuHeight.value = menuEl.value.offsetHeight
  })
})
</script>

<style scoped>
.loading {
  padding: 1.5em;
  opacity: 0.6;
}

.document-layout-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.document-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  margin-top: calc(-1 * var(--bar-size)); /* Ajuste selon ta doc-bar */
}

.document-layout__sidebar {
  width: 250px; /* ou la largeur de ta sidebar */
  min-height: 0;
  border-right: 1px solid #eee; /* optionnel */
}

.document-layout__content {
  flex: 1;
  min-height: 0;
}

/* Assure que CustomScrollbar prend toute la hauteur */
.document-layout__sidebar > .custom-scrollbar,
.document-layout__content > .custom-scrollbar {
  height: 100%;
}

/* Assurer que CustomScrollbar prend toute la hauteur disponible */
:deep(.custom-scrollbar) {
  height: 100%;
}

:deep(.custom-scrollbar__content) {
  height: 100%;
}
</style>
