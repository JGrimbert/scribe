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
            :active="node.nodeId === focusNodeId"
            @click="focusNodeId = node.nodeId"
        >
          {{ node.titre }}
        </BaseChip>
      </div>

      <UiNote v-if="hidden > 0" variant="hint">+ {{ hidden }} autres articles</UiNote>

      <div v-if="selectedNode" class="occ-open">
        <BaseButton variant="outline" @click="goToNode(selectedNode.nodeId)">
          Ouvrir « {{ selectedNode.titre }} » <i class="pi pi-arrow-right"></i>
        </BaseButton>
      </div>
    </template>
  </UiCard>
</template>

<script setup>
import { computed, watch } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import BaseChip from '../ui/BaseChip.vue'
import BaseButton from '../ui/BaseButton.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { selectedLemma: entry, focusNodeId, goToNode, settle } = useAnalyse()

// Tronqué plutôt que scrollé : les articles sont triés par occurrences, la
// traîne n'apporte rien (même parti pris que l'ancienne NodesTable).
const MAX_CHIPS = 20

const shown = computed(() => entry.value?.nodes.slice(0, MAX_CHIPS) ?? [])
const hidden = computed(() => (entry.value?.nodes.length ?? 0) - shown.value.length)

// Article focus = celui sélectionné dans le store, s'il appartient au lemme
// courant (résout titre + cible du bouton « Ouvrir »).
const selectedNode = computed(
  () => entry.value?.nodes.find((n) => n.nodeId === focusNodeId.value) ?? null,
)

// À chaque changement de lemme : auto-sélection de l'occurrence la plus élevée
// (tête de liste). Pilote la sélection de SemantiqueCard via focusNodeId.
watch(
  () => entry.value?.lemma,
  () => {
    const nodes = entry.value?.nodes
    focusNodeId.value = nodes?.length ? nodes[0].nodeId : null
  },
  { immediate: true },
)

// Card apparue et sélection posée → au tour de la proximité sémantique.
settle('occurrences')
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

/* Sélection = liseré bleu (teal du nuage) plus épais. On échange bordure et
   padding (2px de bordure, -1px de padding par côté) pour garder la taille de
   la chip identique : aucune déformation du layout, pas de retour à la ligne.
   Pas de graisse : elle élargirait le texte et pousserait le contenu. */
.occ-chips :deep(.base-chip--active) {
  border-width: 2px;
  border-color: var(--c-accent-alt);
  color: var(--c-accent-alt);
  padding: calc(0.25em - 1px) calc(0.6em - 1px);
}

.occ-open {
  margin-top: var(--sp-3);
}
</style>
