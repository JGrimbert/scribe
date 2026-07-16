<template>
  <template v-if="trame && data">
    <div class="document-layout-wrapper">
      <!-- Hors flux : la zone de scroll occupe TOUTE la hauteur du wrapper et
           démarre donc sous la barre, qui la recouvre en translucide (le
           contenu défile derrière et s'y floute). `topOffset` fait démarrer les
           tracks et le contenu sous la barre. -->
      <div class="document-layout__bar">
        <DocumentBar
            ref="docBarEl"
            :title="title"
            :trame="trame"
            :data="data"
            :current-node-id="currentNodeId"
            :sidebar-expanded="sidebarExpanded"
            :scoped="!isEditor"
            :validation-state="currentValidation"
            :validating="validating"
            @toggle-sidebar="sidebarExpanded = !sidebarExpanded"
            @select="select"
            @toggle-validation="toggleValidation"
        />
      </div>

      <div class="document-layout">
        <!-- Sidebar avec CustomScrollbar -->
        <div
            class="document-layout__sidebar"
            :class="{ 'document-layout__sidebar--rail': !sidebarExpanded }"
        >
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
  validations.value = {}
  const res = await fetch(`/api/documents/${id}`)
  if (!res.ok) {
    alert(`Impossible de charger le document (HTTP ${res.status})`)
    return
  }
  const content = await res.json()
  title.value = content.title ?? ''
  trame.value = content.trame
  data.value = content.data
  validations.value = content.validations ?? {}
  loadTypology(id) // non-awaité : le document s'affiche sans attendre cette réponse
}

// Validations manuelles (nodeId → 'validé' | 'périmé'), résolues par le backend
// au chargement — lui seul peut départager les deux (il rehache le texte).
const validations = ref({})
const validating = ref(false)

// La typologie des styles est-elle arbitrée ? État document, comme trame/data :
// le dashboard s'en sert pour renvoyer vers l'écran de configuration. Chargé à
// part de GET /documents/:id — c'est une autre question, et l'écran de
// typologie a son propre endpoint.
const typologySettled = ref(true) // présumé arbitré : on ne clignote pas avant de savoir
provide('typologySettled', typologySettled)

async function loadTypology(id) {
  try {
    const res = await fetch(`/api/documents/${id}/typology`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { settled } = await res.json()
    typologySettled.value = settled
  } catch {
    // Le renvoi vers la configuration est une invitation, pas une fonction
    // vitale : s'il échoue, on ne casse pas le dashboard pour autant.
    typologySettled.value = true
  }
}

const currentValidation = computed(() =>
    currentNodeId.value ? (validations.value[currentNodeId.value] ?? null) : null,
)

// Un chapitre périmé se REvalide (POST, l'empreinte est rafraîchie) ; seul un
// chapitre à jour se dévalide.
async function toggleValidation(nodeId) {
  if (validating.value) return
  validating.value = true
  const remove = validations.value[nodeId] === 'validé'
  try {
    const res = await fetch(`/api/documents/${route.params.id}/nodes/${nodeId}/validation`, {
      method: remove ? 'DELETE' : 'POST',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (remove) delete validations.value[nodeId]
    else validations.value[nodeId] = 'validé'
  } catch (e) {
    alert(`Impossible de mettre à jour la validation : ${e.message}`)
  } finally {
    validating.value = false
  }
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
  position: relative;
  display: flex;
  flex-direction: column;
  /* PAS `height: 100%` : ce 100% se résout contre `.app` (100vh) et ignore la
     topbar, d'où une boîte qui dépasse le viewport de sa hauteur. */
  flex: 1 1 auto;
  min-height: 0;
}

.document-layout__bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99;
}

.document-layout {
  display: flex;
  flex: 1;
  min-height: 0;
}

.document-layout__sidebar {
  width: 250px;
  flex: 0 0 auto;
  min-height: 0;
  border-right: 1px solid #eee;
}

/* Replié : le rail garde la largeur d'une barre, le contenu récupère le reste. */
.document-layout__sidebar--rail {
  width: var(--bar-size);
}

.document-layout__content {
  flex: 1;
  min-height: 0;
  /* `min-width: auto` (défaut d'un item flex) ferait grandir la colonne jusqu'à
     la largeur intrinsèque de la rangée de folios (~3500px) au lieu de la
     laisser déborder dans la zone de scroll. */
  min-width: 0;
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
