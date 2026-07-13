<template>
  <div class="tree-node">
    <TreeRow
        variant="list"
        :expandable="!!node.children.length"
        :expanded="isExpanded"
        :current="node.id === currentNodeId"
        normalize-case
        :tooltip="tooltip"
        :class="{ 'tree-node__row--axe': depth === 0 }"
        @open="openNode"
        @toggle="$emit('toggle', node.id)"
    >
      {{ node.titre }}
    </TreeRow>

    <Transition name="fold">
      <div v-if="node.children.length && isExpanded" class="children">
        <StructureNode
            v-for="child in node.children"
            :key="child.id"
            :node="child"
            :depth="depth + 1"
            :current-node-id="currentNodeId"
            :expanded-ids="expandedIds"
            @open="$emit('open', $event)"
            @toggle="$emit('toggle', $event)"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TreeRow from './ui/TreeRow.vue'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  currentNodeId: String,
  expandedIds: { type: Object, required: true },
})

const emit = defineEmits(['open', 'toggle'])

const isExpanded = computed(() => props.expandedIds.has(props.node.id))

// Stats (sous-titres, mots) en infobulle — plus de colonnes dédiées depuis la
// suppression du mode « étendu ».
const tooltip = computed(() => {
  const parts = []
  if (props.node.descendants) {
    parts.push(`${props.node.descendants} sous-titre${props.node.descendants > 1 ? 's' : ''}`)
  }
  parts.push(`${props.node.mots.toLocaleString('fr')} mots`)
  return `${props.node.titre}\n${parts.join(' — ')}`
})

// Naviguer déplie aussi la branche (mais ne la replie jamais — le caret sert à ça).
function openNode() {
  if (props.node.children.length && !isExpanded.value) emit('toggle', props.node.id)
  emit('open', props.node.id)
}
</script>

<style scoped>
.tree-node__row--axe {
  color: var(--c-accent);
}

.children {
  margin-left: 0.9em;
  padding-left: 0.35em;
  border-left: 1px dashed var(--c-border);
}

/* Dépliage : fondu + léger glissement (propriétés compositeur uniquement —
   animer la hauteur d'un sous-arbre entier serait exactement le reflow
   saccadé qu'on veut éviter). */
.fold-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fold-enter-from {
  opacity: 0;
  transform: translateY(-0.3em);
}

.fold-leave-active {
  transition: opacity 0.1s ease;
}

.fold-leave-to {
  opacity: 0;
}
</style>
