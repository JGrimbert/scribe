<template>
  <div class="node">
    <TreeRow
        variant="card"
        :expandable="!!node.children.length"
        :expanded="expanded"
        :accent-color="levelColor(node.entry.effectiveLevel)"
        @open="expanded = !expanded"
        @toggle="expanded = !expanded"
    >
      <span v-if="node.entry.hasPageBreak" class="page-break-hint" title="Saut de page forcé sur ce titre">⤓</span>
      {{ node.entry.text }}

      <template #trailing>
        <BaseChip v-if="node.children.length" class="child-count" :count="node.children.length" @click.stop>
          sous-titres
        </BaseChip>

        <div class="level-control" @click.stop>
          <button class="step" @click="$emit('level-change', node.entry.index, node.entry.effectiveLevel - 1)">−</button>
          <span class="level-badge">{{ levelLabel(node.entry.effectiveLevel) }}</span>
          <button class="step" @click="$emit('level-change', node.entry.index, node.entry.effectiveLevel + 1)">+</button>
        </div>
      </template>
    </TreeRow>

    <div v-if="expanded" class="node-children">
      <CalibrationNode
          v-for="child in node.children"
          :key="child.entry.index"
          :node="child"
          @level-change="(...args) => $emit('level-change', ...args)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TreeRow from './ui/TreeRow.vue'
import BaseChip from './ui/BaseChip.vue'

defineProps({
  node: { type: Object, required: true },
})

defineEmits(['level-change'])

const expanded = ref(false)

// Liseret sémantique : une couleur par niveau de titre (pas décoratif —
// c'est l'information que l'utilisateur calibre).
const LEVEL_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7']

function levelColor(level) {
  if (level <= 0) return 'var(--c-gray)'
  return LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length]
}

function levelLabel(level) {
  return level === 0 ? 'Ignoré' : `Niveau ${level}`
}
</script>

<style scoped>
.page-break-hint {
  opacity: var(--op-muted);
  font-size: 0.85em;
  margin-right: 0.3em;
}

.child-count {
  pointer-events: none;
  font-size: var(--fs-xs);
}

.level-control {
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.8em;
  flex: 0 0 auto;
}

.step {
  width: 1.4em;
  height: 1.4em;
  border-radius: 50%;
  border: 1px solid var(--c-border);
  background: none;
  cursor: pointer;
  line-height: 1;
}

.level-badge {
  min-width: 5em;
  text-align: center;
  opacity: 0.8;
}

.node-children {
  margin-left: 1.6em;
  padding-left: 0.6em;
  border-left: 1px dashed var(--c-border);
}
</style>
