<template>
  <aside class="structure-panel" :class="{ 'structure-panel--collapsed': collapsed }">
    <button
        type="button"
        class="collapse-toggle"
        :title="collapsed ? 'Déplier la structure' : 'Replier la structure'"
        @click="collapsed = !collapsed"
    >
      <i class="pi" :class="collapsed ? 'pi-angle-right' : 'pi-angle-left'"></i>
    </button>

    <div v-if="!collapsed" class="panel-content">
      <div v-if="axes.length">
        <div v-for="axe in axes" :key="axe.id" class="axe">
          <h2
              class="axe-title"
              :class="{ 'axe-title--current': axe.id === nodeId }"
              @click="selectNode(axe.id)"
          >
            {{ axe.titre }}
          </h2>

          <div v-if="isAncestorOfCurrent(axe)" class="children">
            <StructureNode
                v-for="child in axe.children"
                :key="child.id"
                :node="child"
                :depth="0"
                :current-node-id="nodeId"
                @open="selectNode"
            />
          </div>
        </div>
      </div>

      <p v-else class="empty">Chargement ou absence de structure…</p>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StructureNode from './StructureNode.vue'

const props = defineProps({
  trame: Object,
  data: Object,
  nodeId: String,
})

const route = useRoute()
const router = useRouter()
const collapsed = ref(false)

function resolve(node) {
  return {
    id: node.id,
    titre: props.data[node.id]?.titre || '(sans titre)',
    children: node.children.map(resolve),
  }
}

const axes = computed(() => {
  if (!props.trame || !props.data) return []
  return props.trame.axes.map(resolve)
})

function containsNode(node, id) {
  if (node.id === id) return true
  return node.children.some((child) => containsNode(child, id))
}

function isAncestorOfCurrent(axe) {
  return !!props.nodeId && containsNode(axe, props.nodeId)
}

function selectNode(nodeId) {
  router.push(`/documents/${route.params.id}/noeud/${nodeId}`)
}
</script>

<style scoped>
.structure-panel {
  flex: 0 0 240px;
  width: 240px;
  background: var(--c-surface4);
  backdrop-filter: var(--c-backdrop-filter-blur);
  max-height: calc(100vh - 2em);
  overflow-y: auto;
  transition: flex-basis 0.15s ease, width 0.15s ease;
}

.structure-panel--collapsed {
  flex: 0 0 auto;
  width: auto;
  overflow: visible;
}

.collapse-toggle {
  position: sticky;
  top: 0;
  display: block;
  width: 100%;
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  padding: 0.6em;
  text-align: right;
}

.structure-panel--collapsed .collapse-toggle {
  text-align: center;
}

.collapse-toggle:hover {
  opacity: 1;
}

.panel-content {
  padding: 0 1em 1em 1em;
}

.axe {
  margin-bottom: 0.2rem;
}

.axe-title {
  cursor: pointer;
}

.axe-title--current {
  font-weight: 700;
}

.children {
  margin-top: 0.3em;
}
</style>
