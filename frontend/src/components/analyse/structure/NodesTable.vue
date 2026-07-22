<template>
  <UiTable>
    <thead>
      <tr><th>Article</th><th>Occurrences</th></tr>
    </thead>
    <tbody>
      <tr v-for="n in shown" :key="n.nodeId" class="row-link" @click="$emit('open', n.nodeId)">
        <td>{{ n.titre }}</td>
        <td>{{ n.count }}</td>
      </tr>
    </tbody>
  </UiTable>
  <UiNote v-if="hidden > 0" variant="hint">+ {{ hidden }} autres articles</UiNote>
</template>

<script setup>
import { computed } from 'vue'
import UiTable from '../../ui/molecules/UiTable.vue'
import UiNote from '../../ui/molecules/UiNote.vue'

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
