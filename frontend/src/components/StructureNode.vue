<template>
  <div class="tree-node">
    <div class="node-title" :style="{ paddingLeft: depth * 1.1 + 'em' }" @click="$emit('open', node)">
      {{ node.titre }}
    </div>
    <StructureNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        @open="$emit('open', $event)"
    />
  </div>
</template>

<script setup>
defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
})

defineEmits(['open'])
</script>

<style scoped>
.node-title {
  cursor: pointer;
  padding-top: 0.15em;
  padding-bottom: 0.15em;
  font-size: 0.9em;
}

.node-title:hover {
  text-decoration: underline;
}
</style>
