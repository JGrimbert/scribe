<template>
  <svg
      class="viz"
      :viewBox="`0 0 ${MAP_SIZE} ${MAP_SIZE}`"
      role="img"
      aria-label="Carte sémantique des segments"
  >
    <circle
        v-for="(point, i) in projectionPoints"
        :key="i"
        :cx="point.cx" :cy="point.cy" r="4"
        class="map-point"
        :fill="point.color"
        :fill-opacity="selectedTopicId === null || point.topicId === selectedTopicId ? 0.85 : 0.15"
        @click="goToNode(point.nodeId)"
    >
      <title>{{ point.titre }} — {{ point.topicLabel }}</title>
    </circle>
  </svg>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { goToNode, selectedTopicId, topicLabelById, topics, topicColor } = useAnalyse()

// data du document (fourni par DocumentLayout) — résolution des titres pour
// les infobulles, sans dupliquer 762 titres dans l'analyse.
const documentData = inject('documentData', ref(null))

// Carte carrée : les coordonnées UMAP sont normalisées à échelle unique côté
// service (aspect-preserving) — les étaler dans un rectangle les redéformerait.
const MAP_SIZE = 440
const MAP_PAD = 18
const toCanvas = (v) => Math.round((MAP_PAD + v * (MAP_SIZE - 2 * MAP_PAD)) * 10) / 10

const projectionPoints = computed(() =>
  (topics.value?.projection ?? []).map((point) => ({
    cx: toCanvas(point.x),
    cy: toCanvas(1 - point.y),
    topicId: point.topicId,
    nodeId: point.nodeId,
    color: topicColor(point.topicId),
    titre: documentData?.value?.[point.nodeId]?.titre ?? '(sans titre)',
    topicLabel:
      point.topicId === -1 ? 'hors thème' : topicLabelById.value.get(point.topicId) ?? 'thème',
  })),
)
</script>

<style scoped>
.map-point {
  stroke: rgba(26, 22, 18, 0.3);
  stroke-width: 0.75;
  cursor: pointer;
}
</style>
