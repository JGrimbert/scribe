<template>
  <aside class="structure-panel" :class="`structure-panel--${mode}`">
    <div class="panel-toolbar">
      <button
          v-if="mode !== 'rail'"
          type="button"
          class="mode-toggle"
          :title="mode === 'etendu' ? 'Revenir à la liste' : 'Replier la structure'"
          @click="narrow"
      >
        <i class="pi pi-angle-left"></i>
      </button>
      <button
          v-if="mode !== 'etendu'"
          type="button"
          class="mode-toggle"
          :title="mode === 'rail' ? 'Déplier la structure' : 'Étendre avec les statistiques'"
          @click="widen"
      >
        <i class="pi pi-angle-right"></i>
      </button>
    </div>

    <div v-if="mode !== 'rail'" class="panel-content">
      <div v-if="mode === 'etendu' && axes.length" class="stats-header">
        <span class="stats-header-label">sous-titres</span>
        <span class="stats-header-label">mots</span>
      </div>

      <template v-if="axes.length">
        <StructureNode
            v-for="axe in axes"
            :key="axe.id"
            :node="axe"
            :depth="0"
            :mode="mode"
            :current-node-id="nodeId"
            :expanded-ids="expandedIds"
            @open="selectNode"
            @toggle="toggleNode"
        />
      </template>

      <p v-else class="empty">Chargement ou absence de structure…</p>
    </div>
  </aside>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StructureNode from './StructureNode.vue'

const props = defineProps({
  trame: Object,
  data: Object,
  nodeId: String,
})

const route = useRoute()
const router = useRouter()

// ── Mode (rail / liste / etendu), persisté entre sessions ──
const MODES = ['rail', 'liste', 'etendu']
const STORAGE_KEY = 'scribe.structure.mode'

const stored = localStorage.getItem(STORAGE_KEY)
const mode = ref(MODES.includes(stored) ? stored : 'liste')

watch(mode, (m) => localStorage.setItem(STORAGE_KEY, m))

function narrow() {
  mode.value = MODES[MODES.indexOf(mode.value) - 1]
}

function widen() {
  mode.value = MODES[MODES.indexOf(mode.value) + 1]
}

// ── Arbre résolu (titres + stats) ──
function resolve(node) {
  const children = node.children.map(resolve)
  return {
    id: node.id,
    titre: props.data[node.id]?.titre || '(sans titre)',
    // stats.mots du backend est déjà agrégé (fullText récursif dans odt-parser)
    mots: props.data[node.id]?.stats?.mots ?? 0,
    descendants: children.reduce((sum, child) => sum + 1 + child.descendants, 0),
    children,
  }
}

const axes = computed(() => {
  if (!props.trame || !props.data) return []
  return props.trame.axes.map(resolve)
})

// ── État plié/déplié de l'accordéon ──
const expandedIds = reactive(new Set())

function toggleNode(id) {
  if (expandedIds.has(id)) expandedIds.delete(id)
  else expandedIds.add(id)
}

// Chemin (ids des ancêtres + le nœud lui-même) vers un id donné.
function pathTo(node, id) {
  if (node.id === id) return [node.id]
  for (const child of node.children) {
    const sub = pathTo(child, id)
    if (sub) return [node.id, ...sub]
  }
  return null
}

// Le chemin vers le nœud courant s'auto-déplie (sans replier le reste).
watch(
  () => [props.nodeId, axes.value],
  () => {
    if (!props.nodeId) return
    for (const axe of axes.value) {
      const path = pathTo(axe, props.nodeId)
      if (path) {
        path.forEach((id) => expandedIds.add(id))
        break
      }
    }
  },
  { immediate: true },
)

function selectNode(nodeId) {
  router.push(`/documents/${route.params.id}/noeud/${nodeId}`)
}
</script>

<style scoped>
.structure-panel {
  flex: 0 0 auto;
  background: var(--c-surface4);
  backdrop-filter: var(--c-backdrop-filter-blur);
  max-height: calc(100vh - 2em);
  display: flex;
  flex-direction: column;
  /* pas de transition de largeur : elle re-layoute tout le contenu à droite
     à chaque frame — c'est le "saccadé" perçu, un switch instantané est plus net */
}

.structure-panel--rail {
  width: 2.6em;
}

.structure-panel--liste {
  width: 260px;
}

.structure-panel--etendu {
  width: 420px;
}

.panel-toolbar {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  padding: 0.35em 0.4em;
}

.structure-panel--rail .panel-toolbar {
  justify-content: center;
}

.mode-toggle {
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  padding: 0.25em;
  line-height: 1;
}

.mode-toggle:hover {
  opacity: 1;
}

.panel-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0.6em 1em;
}

.stats-header {
  display: flex;
  justify-content: flex-end;
  gap: 0.8em;
  padding: 0 0.5em 0.3em 0;
  border-bottom: 1px solid var(--c-border, #e0d8cc);
  margin-bottom: 0.4em;
}

.stats-header-label {
  font-size: 0.7em;
  opacity: 0.55;
  width: 5.2em;
  text-align: right;
}

.empty {
  padding: 0.5em;
  opacity: 0.6;
  font-size: 0.9em;
}
</style>
