<template>
  <!-- Thèmes au fil du livre : un axe par thème, la position dans l'ordre de
       lecture en abscisse, la taille du point = le nombre de segments. La carte
       UMAP dit quels thèmes se ressemblent ; celui-ci dit lequel ouvre le livre et
       lequel n'arrive qu'au dernier tiers. -->
  <AnalyseBlock
      step="flux"
      aside="right"
      :ready="!!rows.length"
      run-label="Lancer l'analyse des thèmes"
      run-hint="l'extraction d'un manuscrit complet prend plusieurs minutes, l'avancement s'affiche ici."
      unavailable="Aucun segment situable dans l'ordre de lecture sur cette analyse."
  >
    <template #main>
      <BaseChart :option="option" :height="height" />
    </template>

    <template #aside>
      <UiCard bare>
        <p class="card-lead">Où chaque thème se pose</p>
        <UiTable>
          <thead>
            <tr><th>Thème</th><th>Chapitres</th><th>Étendue</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in spans" :key="row.topicId">
              <td>
                <span class="lex-swatch" :style="{ background: row.color }"></span>
                {{ row.label }}
              </td>
              <td>{{ row.chapters }}</td>
              <td>{{ row.span }}</td>
            </tr>
          </tbody>
        </UiTable>
        <UiNote variant="hint">
          « Étendue » : la part du livre entre la première et la dernière apparition
          du thème. Proche de 100 %, il court partout ; faible, il est localisé.
        </UiNote>
      </UiCard>
    </template>
  </AnalyseBlock>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import AnalyseBlock from '../AnalyseBlock.vue'
import BaseChart from '../../ui/organisms/BaseChart.vue'
import UiCard from '../../ui/molecules/UiCard.vue'
import UiTable from '../../ui/molecules/UiTable.vue'
import UiNote from '../../ui/molecules/UiNote.vue'
import { useAnalyse } from '../../../composables/useAnalyse'
import { maxCount, topicFlow } from '../../../script/topicFlow'
import { baseOption, chartTokens } from '../../../script/chartBase'
import { formatPercent } from '../../../script/format'

const { topics, topicColor } = useAnalyse()
const trame = inject('documentTrame', ref(null))
const documentTitle = inject('documentTitle', ref(''))

const flow = computed(() => topicFlow(topics.value, trame.value?.axes))
const rows = computed(() => flow.value.rows)
const nodes = computed(() => flow.value.nodes)

// Une bande par thème : la hauteur du graphe suit leur nombre, comme les barres
// des graphes de structure.
const ROW_EM = 2.4
const HEAD_EM = 3
const height = computed(() => `${Math.max(8, rows.value.length * ROW_EM + HEAD_EM)}em`)

const spans = computed(() =>
  rows.value.map((row) => {
    const ranks = row.points.map((p) => p.rank)
    const reach = nodes.value.length > 1 ? (Math.max(...ranks) - Math.min(...ranks)) / (nodes.value.length - 1) : 0
    return {
      topicId: row.topicId,
      label: row.label,
      color: topicColor(row.topicId),
      chapters: row.points.length,
      span: formatPercent(reach),
    }
  }),
)

const option = computed(() => {
  const t = chartTokens()
  const list = rows.value
  const last = nodes.value.length - 1
  const peak = maxCount(list) || 1

  // Chaque thème a SA bande : c'est un jeu de petits multiples, pas huit séries
  // superposées. La couleur n'y sert donc qu'à relier la bande au reste du
  // dashboard (liste des thèmes, carte UMAP) — l'identité, elle, est portée par le
  // nom posé en tête de bande.
  const rowHeight = 100 / Math.max(list.length, 1)
  // `grid` écarté : on est en coordonnées `singleAxis`, il n'y a pas de grille
  // cartésienne à cadrer.
  const { grid, ...base } = baseOption({ watermark: documentTitle.value })
  void grid

  return {
    ...base,
    tooltip: {
      ...base.tooltip,
      trigger: 'item',
      formatter: ({ seriesName, data }) => {
        const node = nodes.value[data[0]]
        return `<strong>${seriesName}</strong><br>${node?.titre ?? ''} — ${data[1]} segment${data[1] > 1 ? 's' : ''}`
      },
    },
    singleAxis: list.map((row, i) => ({
      type: 'value',
      min: 0,
      max: last,
      left: '26%',
      right: 24,
      top: `${i * rowHeight + 4}%`,
      height: `${rowHeight - 8}%`,
      name: row.label,
      nameLocation: 'start',
      nameGap: 12,
      nameTextStyle: { color: t.ink, fontFamily: t.font, fontSize: 12, align: 'right', verticalAlign: 'middle' },
      axisLine: { lineStyle: { color: t.border } },
      axisTick: { show: false },
      // Une seule graduation, sous la dernière bande : toutes les bandes partagent
      // la même échelle, la répéter huit fois ne serait que du bruit.
      axisLabel: {
        show: i === list.length - 1,
        color: t.muted,
        fontFamily: t.font,
        fontSize: 11,
        formatter: (v) => (v === 0 ? 'début' : v === last ? 'fin' : ''),
      },
    })),
    series: list.map((row, i) => ({
      name: row.label,
      type: 'scatter',
      coordinateSystem: 'singleAxis',
      singleAxisIndex: i,
      data: row.points.map((p) => [p.rank, p.count]),
      // Aire (et non diamètre) proportionnelle au compte : c'est la surface que
      // l'œil compare. Plancher à 8 px, sinon un point isolé devient invisible.
      symbolSize: ([, count]) => 8 + 14 * Math.sqrt(count / peak),
      itemStyle: {
        color: topicColor(row.topicId),
        opacity: 0.8,
        borderColor: t.surface,
        borderWidth: 1.5,
      },
    })),
  }
})
</script>
