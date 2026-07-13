<template>
  <UiCard title="Occurrences">
    <UiNote v-if="!entry" variant="hint">
      Sélectionnez un mot du nuage pour voir sa répartition par article.
    </UiNote>

    <template v-else>
      <p class="occ-lead">
        « {{ entry.lemma }} » — {{ entry.count }} occurrence{{ entry.count > 1 ? 's' : '' }}
        sur {{ entry.nodes.length }} article{{ entry.nodes.length > 1 ? 's' : '' }}
      </p>

      <div class="occ-chips">
        <BaseChip
            v-for="node in shown"
            :key="node.nodeId"
            :count="node.count"
            @click="goToNode(node.nodeId)"
        >
          {{ node.titre }}
        </BaseChip>
      </div>

      <UiNote v-if="hidden > 0" variant="hint">+ {{ hidden }} autres articles</UiNote>
    </template>
  </UiCard>
</template>

<script setup>
import { computed } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import BaseChip from '../ui/BaseChip.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const props = defineProps({
  // Entrée lemme sélectionnée dans le nuage ({ lemma, count, nodes[] }) ou null.
  entry: { type: Object, default: null },
})

const { goToNode } = useAnalyse()

// Tronqué plutôt que scrollé : les articles sont triés par occurrences, la
// traîne n'apporte rien (même parti pris que l'ancienne NodesTable).
const MAX_CHIPS = 20

const shown = computed(() => props.entry?.nodes.slice(0, MAX_CHIPS) ?? [])
const hidden = computed(() => (props.entry?.nodes.length ?? 0) - shown.value.length)
</script>

<style scoped>
.occ-lead {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-sm);
  opacity: var(--op-muted);
}

.occ-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
</style>
