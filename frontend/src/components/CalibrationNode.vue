<template>
  <div class="node">
    <div
        class="node-row"
        :style="{ borderLeftColor: levelColor(node.entry.effectiveLevel) }"
        @click="expanded = !expanded"
    >
      <span class="caret" :class="{ 'caret--open': expanded }">{{ node.children.length ? '▸' : '' }}</span>

      <span v-if="node.entry.hasPageBreak" class="page-break-hint" title="Saut de page forcé sur ce titre">⤓</span>
      <span class="entry-text">{{ node.entry.text }}</span>
      <span v-if="node.children.length" class="child-count">{{ node.children.length }}</span>

      <div class="level-control" @click.stop>
        <button class="step" @click="$emit('level-change', node.entry.index, node.entry.effectiveLevel - 1)">−</button>
        <span class="level-badge">{{ levelLabel(node.entry.effectiveLevel) }}</span>
        <button class="step" @click="$emit('level-change', node.entry.index, node.entry.effectiveLevel + 1)">+</button>
      </div>
    </div>

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

defineProps({
  node: { type: Object, required: true },
})

defineEmits(['level-change'])

const expanded = ref(false)

const LEVEL_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7']

function levelColor(level) {
  if (level <= 0) return '#9ca3af'
  return LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length]
}

function levelLabel(level) {
  return level === 0 ? 'Ignoré' : `Niveau ${level}`
}
</script>

<style scoped>
.node-row {
  display: flex;
  align-items: center;
  gap: 0.6em;
  padding: 0.65em 1em;
  margin-bottom: 0.35em;
  background: var(--c-surface4, white);
  border-left: 4px solid transparent;
  border-radius: 0.4em;
  cursor: pointer;
}

.node-row:hover {
  filter: brightness(0.97);
}

.caret {
  width: 0.8em;
  display: inline-block;
  transition: transform 0.15s ease;
  opacity: 0.5;
}

.caret--open {
  transform: rotate(90deg);
}

.page-break-hint {
  opacity: 0.6;
  font-size: 0.85em;
}

.entry-text {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.child-count {
  font-size: 0.75em;
  opacity: 0.5;
  padding: 0.1em 0.5em;
  border-radius: 1em;
  background: rgba(0, 0, 0, 0.06);
}

.level-control {
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.8em;
}

.step {
  width: 1.4em;
  height: 1.4em;
  border-radius: 50%;
  border: 1px solid var(--c-border, #e0d8cc);
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
  border-left: 1px dashed var(--c-border, #e0d8cc);
}
</style>
