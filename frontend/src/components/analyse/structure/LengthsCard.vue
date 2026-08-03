<template>
  <!-- Dispersion des longueurs : un point par chapitre, une colonne par niveau de
       titre. Sans NLP (trame + data seules), donc `needs: null` — jamais en
       attente du service. -->
  <AnalyseBlock
      step="longueurs"
      aside="right"
      :ready="!!groups.length"
      unavailable="Aucun chapitre à mesurer dans ce document."
  >
    <template #main>
      <BaseChart :option="option" height="22em" />
    </template>

    <template #aside>
      <UiCard bare>
        <p class="card-lead">Longueur d’un chapitre, par niveau</p>
        <UiTable>
          <thead>
            <tr><th>Niveau</th><th>Chapitres</th><th>Médiane</th><th>Le plus long</th></tr>
          </thead>
          <tbody>
            <tr v-for="g in groups" :key="g.key">
              <td>{{ g.label }}</td>
              <td>{{ g.points.length }}</td>
              <!-- Arrondi : la médiane d'un compte pair tombe sur un demi-signe. -->
              <td>{{ formatInt(Math.round(g.median)) }}</td>
              <td>{{ formatInt(g.max) }}</td>
            </tr>
          </tbody>
        </UiTable>
        <UiNote variant="hint">
          En signes. La médiane, pas la moyenne : un seul chapitre monstre suffit à
          rendre une moyenne fausse pour tous les autres.
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
import { dispersionGroups } from '../../../script/lengthDispersion'
import { axisDecor, baseOption, chartTokens } from '../../../script/chartBase'
import { cssVar } from '../../../script/theme'
import { formatInt } from '../../../script/format'

// Fournis par DocumentLayout (comme pour les stats de l'en-tête du dashboard) :
// cette card ne doit rien au backend d'analyse.
const trame = inject('documentTrame', ref(null))
const data = inject('documentData', ref(null))
const documentTitle = inject('documentTitle', ref(''))

const groups = computed(() => dispersionGroups(trame.value?.axes, data.value))

const option = computed(() => {
  const t = chartTokens()
  const axis = axisDecor(t)
  const base = baseOption({
    watermark: documentTitle.value,
    grid: { left: 8, right: 20, top: 16, bottom: 4 },
  })

  return {
    ...base,
    tooltip: {
      ...base.tooltip,
      trigger: 'item',
      formatter: ({ data: point }) => `<strong>${point.name}</strong><br>${formatInt(point.value[1])} signes`,
    },
    xAxis: {
      type: 'category',
      data: groups.value.map((g) => g.label),
      // Jitter porté par l'AXE (echarts 6) : les points d'une même colonne
      // s'écartent latéralement au lieu de se recouvrir. Sans lui, dix chapitres
      // de longueur voisine ne font qu'une marque et la densité disparaît.
      jitter: 28,
      jitterOverlap: false,
      jitterMargin: 2,
      ...axis,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      ...axis,
      // Milliers de signes : l'échelle exacte se lit dans l'infobulle et dans la
      // table, l'axe n'a qu'à donner l'ordre de grandeur.
      axisLabel: { ...axis.axisLabel, formatter: (v) => (v >= 1000 ? `${Math.round(v / 1000)} k` : v) },
    },
    series: [
      {
        type: 'scatter',
        // Une seule teinte : c'est la POSITION en colonne qui dit le niveau, la
        // couleur n'aurait fait que le redire — et trois teintes catégorielles
        // qui se côtoient toutes (nuage de points) ne passent pas les seuils de
        // séparation (cf. base.css).
        symbolSize: 9,
        data: groups.value.flatMap((g, i) => g.points.map((p) => ({ name: p.titre, value: [i, p.chars] }))),
        itemStyle: {
          color: cssVar('--c-cat-1'),
          opacity: 0.75,
          // Liseré à la couleur du papier : deux points qui se touchent restent
          // deux points.
          borderColor: t.surface,
          borderWidth: 1.5,
        },
      },
    ],
  }
})
</script>
