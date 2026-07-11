<template>
  <div class="tree-node">
    <div
        class="node-row"
        :class="{ 'node-row--current': node.id === currentNodeId, 'node-row--axe': depth === 0 }"
        :title="tooltip"
        @click="openNode"
    >
      <button
          v-if="node.children.length"
          type="button"
          class="caret"
          :class="{ 'caret--open': isExpanded }"
          :title="isExpanded ? 'Replier' : 'Déplier'"
          @click.stop="$emit('toggle', node.id)"
      >
        <i class="pi pi-angle-right"></i>
      </button>
      <span v-else class="leaf-icon"><i class="pi pi-file"></i></span>

      <span class="node-titre">{{ node.titre }}</span>

      <template v-if="mode === 'etendu'">
        <span class="stat-col">{{ node.descendants || '—' }}</span>
        <span class="stat-col">{{ node.mots.toLocaleString('fr') }}</span>
      </template>
    </div>

    <Transition name="fold">
      <div v-if="node.children.length && isExpanded" class="children">
        <StructureNode
            v-for="child in node.children"
            :key="child.id"
            :node="child"
            :depth="depth + 1"
            :mode="mode"
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

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  mode: { type: String, required: true },
  currentNodeId: String,
  expandedIds: { type: Object, required: true },
})

const emit = defineEmits(['open', 'toggle'])

const isExpanded = computed(() => props.expandedIds.has(props.node.id))

// En mode liste les stats vivent dans l'infobulle ; en étendu elles sont visibles.
const tooltip = computed(() => {
  if (props.mode !== 'liste') return null
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
.node-row {
  display: flex;
  align-items: center;
  gap: 0.35em;
  padding: 0.25em 0.5em 0.25em 0.35em;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9em;
}

.node-row:hover {
  background: var(--c-surface3, rgba(255, 255, 255, 0.6));
}

.node-row--current {
  font-weight: 700;
  background: var(--c-surface3, rgba(255, 255, 255, 0.6));
}

.node-row--axe {
  color: var(--c-accent);
}

.caret {
  flex: 0 0 auto;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  width: 1.1em;
  opacity: 0.55;
  line-height: 1;
}

.caret i {
  font-size: 0.8em;
  display: inline-block;
  transition: transform 0.15s ease;
}

.caret--open i {
  transform: rotate(90deg);
}

.caret:hover {
  opacity: 1;
}

.leaf-icon {
  flex: 0 0 auto;
  width: 1.1em;
  opacity: 0.35;
  line-height: 1;
}

.leaf-icon i {
  font-size: 0.7em;
}

/* Casse unifiée : tout en bas de casse, initiale en capitale.
   (le span est un item flex, donc blockifié — ::first-letter s'applique) */
.node-titre {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: lowercase;
}

.node-titre::first-letter {
  text-transform: uppercase;
}

.stat-col {
  flex: 0 0 auto;
  width: 5.2em;
  text-align: right;
  font-size: 0.8em;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
  font-weight: normal;
}

.children {
  margin-left: 0.9em;
  padding-left: 0.35em;
  border-left: 1px dashed var(--c-border, #e0d8cc);
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
