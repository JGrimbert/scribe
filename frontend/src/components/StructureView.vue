<template>
  <aside class="structure-panel" :class="expanded ? 'structure-panel--liste' : 'structure-panel--rail'">
    <div v-if="expanded" class="panel-content">
      <template v-if="axes.length">
        <StructureNode
            v-for="axe in axes"
            :key="axe.id"
            :node="axe"
            :depth="0"
            :current-node-id="nodeId"
            :expanded-ids="expandedIds"
            @open="$emit('select', $event)"
            @toggle="toggleNode"
        />
      </template>

      <p v-else class="empty">Chargement ou absence de structure…</p>
    </div>
  </aside>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import StructureNode from './StructureNode.vue'
import { pathToInAxes } from '../script/trame'

const props = defineProps({
  trame: Object,
  data: Object,
  nodeId: String,
  expanded: Boolean,
})

defineEmits(['select'])

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

// Le chemin vers le nœud courant s'auto-déplie (sans replier le reste).
watch(
  () => [props.nodeId, axes.value],
  () => {
    if (!props.nodeId) return
    pathToInAxes(props.trame?.axes ?? [], props.nodeId).forEach((id) => expandedIds.add(id))
  },
  { immediate: true },
)
</script>

<style scoped>
.structure-panel {
  flex: 0 0 auto;
  margin-top: 42px;
  display: flex;
  flex-direction: column;
  background-color: #f1f2e4;
}

.panel-content {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.6em 0.6em 1em;
}

.empty {
  padding: 0.5em;
  opacity: 0.6;
  font-size: 0.9em;
}
</style>
