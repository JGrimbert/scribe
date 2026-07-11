<template>
  <table class="data-table">
    <thead>
      <tr><th>Article</th><th>Occurrences</th></tr>
    </thead>
    <tbody>
      <tr v-for="n in shown" :key="n.nodeId" class="word-node-row" @click="$emit('open', n.nodeId)">
        <td>{{ n.titre }}</td>
        <td>{{ n.count }}</td>
      </tr>
    </tbody>
  </table>
  <p v-if="hidden > 0" class="hint">+ {{ hidden }} autres articles</p>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  nodes: { type: Array, required: true },
})

defineEmits(['open'])

// Tronqué plutôt que scrollé : les entrées sont triées par occurrences,
// la traîne n'apporte rien.
const MAX_ROWS = 15

const shown = computed(() => props.nodes.slice(0, MAX_ROWS))
const hidden = computed(() => props.nodes.length - shown.value.length)
</script>
