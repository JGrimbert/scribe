<template>
  <main v-if="axes.length" class="main-view">
    <div v-for="axe in axes" :key="axe.id" class="axe">
      <h2
          class="axe-title"
          :class="{ 'axe-title--current': axe.id === axeId }"
          @click="selectAxe(axe.id)"
      >
        {{ axe.titre }}
      </h2>

      <div v-if="axe.id === axeId" class="children">
        <StructureNode
            v-for="child in axe.children"
            :key="child.id"
            :node="child"
            :depth="0"
            @open="$emit('openNode', $event)"
        />
      </div>
    </div>
  </main>

  <div v-else class="empty">
    <p>Chargement ou absence de structure…</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StructureNode from './StructureNode.vue'

const props = defineProps({
  trame: Object,
  data: Object,
  axeId: String,
})

defineEmits(['openNode'])

const route = useRoute()
const router = useRouter()

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

function selectAxe(axeId) {
  router.push(`/documents/${route.params.id}/axe/${axeId}`)
}
</script>

<style scoped>
.main-view {
  width: 240px;
  margin: 1em;
  border-radius: 1em;
  padding: 1em;
  position: fixed;
  z-index: 1;
  background: var(--c-surface4);
  backdrop-filter: var(--c-backdrop-filter-blur);
  max-height: calc(100vh - 2em);
  overflow-y: auto;
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
