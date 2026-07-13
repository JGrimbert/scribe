<template>
  <UiCard v-if="groups.length" title="Entités nommées (liste complète)">
    <UiNote variant="hint">
      Personnes et lieux sont aussi des filtres du nuage. La liste complète (avec organisations
      et « divers », encore bruités) est conservée ici pour comparaison.
    </UiNote>
    <ChipGroup
        v-for="group in groups"
        :key="group.label"
        :title="group.title"
        :meta="group.total > group.entities.length ? `${group.total}, ${group.entities.length} affichées` : String(group.total)"
    >
      <BaseChip
          v-for="entity in group.entities"
          :key="entity.text"
          :count="entity.count"
          is-static
      >
        {{ entity.text }}
      </BaseChip>
    </ChipGroup>
  </UiCard>
</template>

<script setup>
import { computed } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import ChipGroup from '../ui/ChipGroup.vue'
import BaseChip from '../ui/BaseChip.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { analysis } = useAnalyse()

// Tronqué plutôt que scrollé : les entités sont triées par occurrences.
const MAX_ENTITIES_PER_GROUP = 24

// Liste complète conservée pour comparaison : les 4 types, y compris Personnes
// et Lieux désormais aussi accessibles comme filtres du nuage. Ordre stable.
const ENTITY_LABELS_FR = { PER: 'Personnes', LOC: 'Lieux', ORG: 'Organisations', MISC: 'Divers' }

const groups = computed(() => {
  const byLabel = new Map()
  for (const entity of analysis.value?.lexical?.entities ?? []) {
    if (!byLabel.has(entity.label)) byLabel.set(entity.label, [])
    byLabel.get(entity.label).push(entity)
  }
  return Object.keys(ENTITY_LABELS_FR)
    .filter((label) => byLabel.has(label))
    .map((label) => {
      const entities = byLabel.get(label)
      return {
        label,
        title: ENTITY_LABELS_FR[label],
        total: entities.length,
        entities: entities.slice(0, MAX_ENTITIES_PER_GROUP),
      }
    })
})
</script>
