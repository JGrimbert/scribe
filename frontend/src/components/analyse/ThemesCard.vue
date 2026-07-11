<template>
  <AnalyseCard title="Thèmes" wide :busy="running === 'topics'">
    <div v-if="running === 'topics' && topicsProgress" class="topics-progress">
      <span class="score-bar-track topics-progress-track">
        <span class="score-bar" :style="{ width: topicsProgress.pct + '%' }"></span>
      </span>
      <span class="topics-progress-label">{{ topicsProgress.step }} ({{ Math.round(topicsProgress.pct) }} %)</span>
    </div>

    <p v-if="stepErrors.topics" class="state state--error">{{ stepErrors.topics }}</p>
    <p v-if="!topics && running !== 'topics'" class="state">
      Analyse pas encore calculée. Nécessite le service NLP local (<code>npm run dev:nlp</code>) —
      l'extraction d'un manuscrit complet prend plusieurs minutes, l'avancement s'affiche ici.
    </p>

    <template v-if="topics">
      <div class="topics-columns">
        <div>
          <p class="hint">
            {{ topics.topics.length }} thèmes détectés —
            {{ topics.outliers.count }} segments hors thème ({{ formatPercent(topics.outliers.share) }}).
            Les mots listés sont les plus caractéristiques de chaque thème (c-TF-IDF), pas des titres.
          </p>

          <div class="entity-chips topic-chips">
            <button
                v-for="topic in topics.topics"
                :key="topic.topicId"
                type="button"
                class="entity-chip"
                :class="{ 'entity-chip--active': selectedTopicId === topic.topicId }"
                @click="selectedTopicId = selectedTopicId === topic.topicId ? null : topic.topicId"
            >
              <span class="topic-dot" :style="{ background: topicColor(topic.topicId) }"></span>
              {{ topic.label }} <span class="entity-count">{{ topic.count }}</span>
            </button>
          </div>

          <template v-if="selectedTopic">
            <h3>Thème « {{ selectedTopic.label }} » — {{ selectedTopic.count }} segments ({{ formatPercent(selectedTopic.share) }})</h3>

            <div class="topic-words">
              <span
                  v-for="word in selectedTopic.words"
                  :key="word.word"
                  class="topic-word"
                  :style="{ opacity: 0.55 + 0.45 * (word.weight / selectedTopic.words[0].weight) }"
              >
                {{ word.word }}
              </span>
            </div>

            <h3>Présence par axe</h3>
            <table class="data-table">
              <tbody>
                <tr v-for="row in selectedTopicByAxe" :key="row.axeId ?? 'liminaire'">
                  <td>{{ row.titre }}</td>
                  <td class="score-col">
                    <span class="score-bar-track">
                      <span class="score-bar" :style="{ width: row.pct + '%' }"></span>
                    </span>
                    <span class="score-value">{{ row.count }} / {{ row.segments }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
          <p v-else class="hint">Cliquer un thème pour son détail (mots, présence par axe).</p>
        </div>

        <div>
          <template v-if="topics.projection?.length">
            <h3>Carte des segments</h3>
            <p class="hint">
              Chaque point est un segment de ~250 mots, placé par proximité sémantique (UMAP) —
              deux points voisins parlent de choses proches, quel que soit leur chapitre.
              Cliquer un thème le met en évidence ; cliquer un point ouvre son article.
            </p>
            <svg class="viz" viewBox="0 0 640 420" role="img" aria-label="Carte sémantique des segments">
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
            <div class="map-legend">
              <span v-for="item in mapLegend" :key="item.label" class="map-legend-item">
                <span class="topic-dot" :style="{ background: item.color }"></span>{{ item.label }}
              </span>
            </div>
          </template>
          <p v-else class="hint">
            Carte des segments indisponible sur cette analyse — relancer l'analyse pour l'obtenir.
          </p>
        </div>
      </div>
    </template>
  </AnalyseCard>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import AnalyseCard from './AnalyseCard.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { formatPercent } from '../../script/format'

const { analysis, running, stepErrors, topicsProgress, goToNode } = useAnalyse()

// data du document (fourni par DocumentLayout) — résolution des titres pour
// les infobulles de la carte, sans dupliquer 762 titres dans l'analyse.
const documentData = inject('documentData', ref(null))

const selectedTopicId = ref(null)

const topics = computed(() => analysis.value?.topics ?? null)

const selectedTopic = computed(
  () => topics.value?.topics.find((t) => t.topicId === selectedTopicId.value) ?? null,
)

// Palette catégorielle validée (scripts/validate_palette.js du guide dataviz,
// surface #faf8f4 : ΔE CVD 24,2, tous les checks passent). Ordre FIXE — les
// 7 premiers thèmes (déjà triés par taille) prennent les 7 teintes, le reste
// bascule en gris : au-delà, plus personne ne distingue les couleurs.
const TOPIC_PALETTE = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4']
const COLOR_OTHER = '#8a7f72'
const COLOR_OUTLIER = '#cfc5b6'

const topicColorById = computed(() => {
  const map = new Map()
  topics.value?.topics.forEach((topic, i) => {
    map.set(topic.topicId, i < TOPIC_PALETTE.length ? TOPIC_PALETTE[i] : COLOR_OTHER)
  })
  return map
})

function topicColor(topicId) {
  return topicColorById.value.get(topicId) ?? COLOR_OUTLIER
}

const topicLabelById = computed(
  () => new Map((topics.value?.topics ?? []).map((t) => [t.topicId, t.label])),
)

const MAP_W = 640
const MAP_H = 420
const MAP_PAD = 12

const projectionPoints = computed(() =>
  (topics.value?.projection ?? []).map((point) => ({
    cx: Math.round((MAP_PAD + point.x * (MAP_W - 2 * MAP_PAD)) * 10) / 10,
    cy: Math.round((MAP_PAD + (1 - point.y) * (MAP_H - 2 * MAP_PAD)) * 10) / 10,
    topicId: point.topicId,
    nodeId: point.nodeId,
    color: topicColor(point.topicId),
    titre: documentData?.value?.[point.nodeId]?.titre ?? '(sans titre)',
    topicLabel:
      point.topicId === -1 ? 'hors thème' : topicLabelById.value.get(point.topicId) ?? 'thème',
  })),
)

const mapLegend = computed(() => {
  const colored = (topics.value?.topics ?? [])
    .slice(0, TOPIC_PALETTE.length)
    .map((topic, i) => ({
      color: TOPIC_PALETTE[i],
      label: topic.label.split(' · ').slice(0, 2).join(' · '),
    }))
  const extras = []
  if ((topics.value?.topics.length ?? 0) > TOPIC_PALETTE.length) {
    extras.push({ color: COLOR_OTHER, label: 'autres thèmes' })
  }
  if (topics.value?.outliers.count) {
    extras.push({ color: COLOR_OUTLIER, label: 'hors thème' })
  }
  return [...colored, ...extras]
})

// Présence du thème sélectionné dans chaque axe, en % des segments de l'axe
// (pas du total : les axes n'ont pas tous la même longueur).
const selectedTopicByAxe = computed(() => {
  if (!selectedTopic.value || !topics.value) return []
  const topicId = selectedTopic.value.topicId
  return topics.value.axes.map((axe) => {
    const count = axe.distribution.find((d) => d.topicId === topicId)?.count ?? 0
    return {
      axeId: axe.axeId,
      titre: axe.titre,
      segments: axe.segments,
      count,
      pct: axe.segments ? (count / axe.segments) * 100 : 0,
    }
  })
})
</script>

<style scoped>
.topics-progress {
  display: flex;
  align-items: center;
  gap: 0.75em;
  padding: 0.5em 0 1em;
}

.topics-progress-track {
  width: 16em;
}

.topics-progress-label {
  font-size: 0.85em;
  opacity: 0.7;
}

/* Deux colonnes internes : thèmes + détail à gauche, carte à droite. */
.topics-columns {
  display: grid;
  grid-template-columns: minmax(24em, 1fr) minmax(24em, 1fr);
  gap: 1.5em;
  align-items: start;
}

@media (max-width: 70em) {
  .topics-columns {
    grid-template-columns: 1fr;
  }
}

.topic-chips {
  margin-top: 0.5em;
}

.topic-words {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em 0.8em;
  padding: 0.4em 0 0.6em;
  font-family: Georgia, serif;
  font-size: 1.05em;
  color: var(--c-accent);
}

.map-point {
  stroke: rgba(26, 22, 18, 0.3);
  stroke-width: 0.75;
  cursor: pointer;
}

.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35em 1.1em;
  font-size: 0.8em;
  opacity: 0.85;
  margin-bottom: 1em;
}

.map-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}
</style>
