<template>
  <div class="conformity">
    <p class="conformity-lead">
      <strong>{{ conformity.conformCount }}</strong> nœud(s) conforme(s) sur
      {{ conformity.judgedCount }} — {{ formatPercent(rate) }}.
      <span class="conformity-hint">Indicatif : la validation reste manuelle.</span>
    </p>
    <BaseChart :option="option" :height="height" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BaseChart from '../ui/BaseChart.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { formatPercent } from '../../script/format'
import { cssVar } from '../../script/theme'

const { analysis } = useAnalyse()

// « nœud » et non « chapitre » : les règles étant modulables par profondeur, un
// axe peut être jugé si l'utilisateur l'a décrété (cf. backend/rules.ts). Sans
// réglage — le cas nominal — ce sont exactement les feuilles.
const conformity = computed(() => analysis.value?.conformity ?? { conformCount: 0, judgedCount: 0, criteria: [] })

const rate = computed(() =>
  conformity.value.judgedCount ? conformity.value.conformCount / conformity.value.judgedCount : 0,
)

// Trié par échec décroissant : une comparaison de grandeurs se lit ordonnée,
// et le critère qui bloque le plus doit sauter aux yeux.
const rows = computed(() => [...conformity.value.criteria].sort((a, b) => b.failing - a.failing))

const height = computed(() => `${Math.max(6, rows.value.length * 2.2 + 2)}em`)

const option = computed(() => {
  const ink = cssVar('--c-ink')
  const ink2 = cssVar('--c-ink2')
  const font = cssVar('--font-ui', 'system-ui, sans-serif')
  // Une seule série, donc une seule teinte : colorier chaque barre
  // différemment dépenserait le canal « identité » à redire ce que la
  // longueur montre déjà.
  const fill = cssVar('--c-ramp-3')

  return {
    grid: { left: 4, right: 40, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'item',
      valueFormatter: (v) => `${v} chapitre${v > 1 ? 's' : ''} en échec`,
    },
    xAxis: { type: 'value', max: conformity.value.judgedCount || 1, show: false },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.value.map((c) => c.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ink, fontFamily: font, fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 18,
        data: rows.value.map((c) => c.failing),
        itemStyle: { color: fill, borderRadius: [0, 3, 3, 0] },
        label: {
          show: true,
          position: 'right',
          formatter: ({ value }) => `${value}`,
          color: ink2,
          fontFamily: font,
          fontSize: 11,
        },
      },
    ],
  }
})
</script>

<style scoped>
.conformity-lead {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-ink);
}

.conformity-hint {
  opacity: var(--op-muted);
}
</style>
