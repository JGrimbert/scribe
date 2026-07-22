<template>
  <!-- Footer : thèmes (pastille = légende + sélecteur) puis explication.
       Pendant un recalcul, l'avancement remplace le footer. -->
  <UiCard bare>
    <div v-if="running === 'topics' && topicsProgress" class="topics-progress">
      <ScoreBar
          :pct="topicsProgress.pct"
          :label="`${topicsProgress.step} (${Math.round(topicsProgress.pct)} %)`"
          track-width="16em"
      />
    </div>
    <template v-else>
      <ChipGroup>
        <BaseChip
            v-for="topic in topics.topics"
            :key="topic.topicId"
            :count="topic.count"
            :dot="topicColor(topic.topicId)"
            :active="selectedTopicId === topic.topicId"
            @click="selectedTopicId = selectedTopicId === topic.topicId ? null : topic.topicId"
        >
          {{ topic.label }}
        </BaseChip>
      </ChipGroup>
      <p class="map-hint">
        {{ topics.topics.length }} thèmes · {{ topics.outliers.count }} segments hors thème
        ({{ formatPercent(topics.outliers.share) }}). Chaque point est un segment de ~250 mots
        placé par proximité sémantique (UMAP) ; cliquer un point ouvre son article, cliquer un
        thème le met en évidence.
      </p>
    </template>
  </UiCard>
</template>

<script setup>
import ChipGroup from "../../ui/molecules/ChipGroup.vue";
import BaseChip from "../../ui/atoms/BaseChip.vue";
import {useAnalyse} from "../../../composables/useAnalyse.js";
import { formatPercent } from '../../../script/format'
import ScoreBar from "../../ui/atoms/ScoreBar.vue";
import UiCard from "../../ui/molecules/UiCard.vue";

const { running, topicsProgress, topics, topicColor, selectedTopicId } = useAnalyse()
</script>

<style scoped>

.topics-progress {
  padding: 0.5em 0;
}

.map-hint {
  margin-top: var(--sp-2);
  font-size: var(--fs-sm);
  opacity: var(--op-muted);
}
</style>