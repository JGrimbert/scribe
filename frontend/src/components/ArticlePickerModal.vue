<template>
  <div class="picker-backdrop" @click.self="emit('close')">
    <div class="picker-modal">
      <div class="picker-header">
        <input
            ref="filterInput"
            v-model="filter"
            type="text"
            placeholder="Filtrer par titre…"
            class="picker-filter"
        />
        <button type="button" class="picker-close" @click="emit('close')">
          <i class="pi pi-times"></i>
        </button>
      </div>
      <div class="picker-list">
        <div
            v-for="node in filteredNodes"
            :key="node.id"
            class="picker-item"
            :style="{ paddingLeft: node.depth * 1.1 + 'em' }"
            @click="emit('select', node.id)"
        >
          {{ node.titre }}
        </div>
        <p v-if="!filteredNodes.length" class="picker-empty">Aucun article ne correspond.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  trame: Object,
  data: Object,
})
const emit = defineEmits(['select', 'close'])

const filter = ref('')
const filterInput = ref(null)

onMounted(() => filterInput.value?.focus())

function flatten(node, depth, out) {
  const item = props.data[node.id]
  out.push({ id: node.id, titre: item?.titre || '(sans titre)', depth })
  node.children.forEach((child) => flatten(child, depth + 1, out))
}

const allNodes = computed(() => {
  if (!props.trame || !props.data) return []
  const out = []
  props.trame.axes.forEach((axe) => flatten(axe, 0, out))
  return out
})

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g')
function normalize(str) {
  return str.normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase()
}

const filteredNodes = computed(() => {
  const f = normalize(filter.value.trim())
  if (!f) return allNodes.value
  return allNodes.value.filter((n) => normalize(n.titre).includes(f))
})
</script>

<style scoped>
.picker-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.picker-modal {
  width: 420px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
}

.picker-filter {
  flex: 1 1 auto;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95em;
}

.picker-close {
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  padding: 4px;
}

.picker-close:hover {
  opacity: 1;
}

.picker-list {
  overflow-y: auto;
  padding: 8px 0;
}

.picker-item {
  padding: 0.35em 1em;
  cursor: pointer;
  font-size: 0.92em;
}

.picker-item:hover {
  background: var(--c-surface4, #f0f0f0);
}

.picker-empty {
  padding: 0.5em 1em;
  color: #999;
  font-style: italic;
}
</style>
