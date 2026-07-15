<template>
  <!-- Bloc thèmes : carte des segments (2/3) à gauche, détail au clic (1/3) à
       droite — même orientation que le bloc-nuage. Cadre et contenu se révèlent
       d'un bloc. -->
  <Transition name="reveal" appear>
    <div v-if="isRevealed('themes')" class="split">
      <!-- Pas de données : message plein largeur. -->
      <div v-if="!topics" class="themes-message">
        <UiNote v-if="stepErrors.topics" variant="error">{{ stepErrors.topics }}</UiNote>
        <div v-if="running === 'topics' && topicsProgress" class="topics-progress">
          <ScoreBar
              :pct="topicsProgress.pct"
              :label="`${topicsProgress.step} (${Math.round(topicsProgress.pct)} %)`"
              track-width="16em"
          />
        </div>
        <template v-else-if="running !== 'topics'">
          <UiNote>
            Analyse pas encore calculée. Nécessite le service NLP local (<code>npm run dev:nlp</code>) —
            l'extraction d'un manuscrit complet prend plusieurs minutes, l'avancement s'affiche ici.
          </UiNote>
          <BaseButton variant="outline" icon="pi-play" :busy="!!running" class="run-step" @click="runStep('topics')">
            Lancer l'analyse des thèmes
          </BaseButton>
        </template>
      </div>

      <template v-else>
        <!-- Carte des segments (viz) -->
        <div class="split-main">
          <div class="map-body">
            <UiNote v-if="!topics.projection?.length" variant="hint">
              Carte des segments indisponible sur cette analyse — relancer l'analyse pour l'obtenir.
            </UiNote>
            <svg
                v-else
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
          </div>
        </div>

        <!-- Détail du thème au clic -->
        <div class="split-right">
          <ThemeList />
          <template v-if="selectedTopic">
            <UiCard bare>
              <p class="detail-lead">
                Thème « {{ selectedTopic.label }} » — {{ selectedTopic.count }} segments
                ({{ formatPercent(selectedTopic.share) }})
              </p>
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
            </UiCard>
            <UiCard bare>
              <p class="detail-lead">Présence par axe</p>
              <UiTable>
                <tbody>
                  <tr v-for="row in selectedTopicByAxe" :key="row.axeId ?? 'liminaire'">
                    <td>{{ row.titre }}</td>
                    <td class="score-col">
                      <ScoreBar :pct="row.pct" :label="`${row.count} / ${row.segments}`" />
                    </td>
                  </tr>
                </tbody>
              </UiTable>
            </UiCard>
          </template>
          <UiCard v-else bare>
            <UiNote variant="hint">
              Cliquer un thème pour son détail : mots caractéristiques et présence par axe.
            </UiNote>
          </UiCard>
        </div>
      </template>
    </div>
  </Transition>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import UiTable from '../ui/UiTable.vue'
import ScoreBar from '../ui/ScoreBar.vue'
import BaseButton from '../ui/BaseButton.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { formatPercent } from '../../script/format'
import ThemeList from "./ThemeList.vue";

const {
  analysis, running, stepErrors, isRevealed, goToNode, settle, runStep,
  topicsProgress, selectedTopic, selectedTopicId, topicLabelById, topics, topicColor,
} = useAnalyse()

// Monté d'emblée (cadre symétrique des autres blocs) : on relaie à la chaîne de
// révélation quand le contenu apparaît, pas au montage.
watch(() => isRevealed('themes'), (revealed) => { if (revealed) settle('themes') }, { immediate: true })

watch(selectedTopicId, v => console.log('Parent', v))

// data du document (fourni par DocumentLayout) — résolution des titres pour
// les infobulles de la carte, sans dupliquer 762 titres dans l'analyse.
const documentData = inject('documentData', ref(null))

// Carte carrée : les coordonnées UMAP sont désormais normalisées à échelle
// unique côté service (aspect-preserving) — les étaler dans un rectangle les
// redéformerait. Un carré préserve la proximité relative des points.
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
.themes-message {
  flex: 1;
  padding: var(--split-pad);
}

.run-step {
  margin-top: 0.75em;
}

/* Carte : occupe l'espace entre le haut du bloc et le footer. */
.map-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 18em;
  padding: 1em;
}

.viz {
  display: block;
  width: 100%;
  height: auto;
}

.map-point {
  stroke: rgba(26, 22, 18, 0.3);
  stroke-width: 0.75;
  cursor: pointer;
}


/* En-tête de chaque module du détail — même graisse que les leads du nuage
   (Occurrences / Proximité). */
.detail-lead {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink);
}

.topic-words {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em 0.8em;
  font-family: var(--font-serif);
  font-size: 1.05em;
  color: var(--c-accent);
}
</style>
