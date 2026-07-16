<template>
  <BaseChart :option="option" :height="height" />
</template>

<script setup>
import { computed } from 'vue'
import BaseChart from '../ui/BaseChart.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { cssVar } from '../../script/theme'

const { analysis } = useAnalyse()

// Une barre par axe de tête + le total en dernier (cf. backend, assessCompleteness).
const groups = computed(() => analysis.value?.completeness?.distribution ?? [])

const height = computed(() => `${Math.max(8, groups.value.length * 2.2 + 3)}em`)

// Barres normalisées à 100 % : les axes n'ont pas le même nombre de chapitres,
// c'est le taux d'avancement qu'on compare, pas la taille. Le compte brut n'est
// pas perdu — il reste dans l'étiquette de l'axe, dans les segments et dans
// l'infobulle.
function pointsFor(rows, statusIndex) {
  return rows.map((row) => {
    const count = row.distribution[statusIndex].count
    return { value: row.leafCount ? (count / row.leafCount) * 100 : 0, count }
  })
}

// Couleur par état. Les quatre paliers rédactionnels suivent la rampe ordinale
// (clair → foncé = la progression se lit dans la couleur) ; les deux états de
// relecture sortent de la rampe, ce sont des statuts (cf. base.css).
const COLOR_TOKENS = {
  vide: '--c-ramp-1',
  ébauche: '--c-ramp-2',
  partiel: '--c-ramp-3',
  rédigé: '--c-ramp-4',
  validé: '--c-status-valide',
  périmé: '--c-status-perime',
}

// Étiquette posée sur le remplissage : les deux paliers clairs de la rampe
// demandent de l'encre, tous les autres fonds du blanc.
const LIGHT_FILLS = ['vide', 'ébauche']

const option = computed(() => {
  const ink = cssVar('--c-ink')
  const ink2 = cssVar('--c-ink2')
  const surface = cssVar('--c-paper')

  const rows = groups.value
  const statuses = rows[0]?.distribution.map((s) => s.status) ?? []
  const font = cssVar('--font-ui', 'system-ui, sans-serif')

  return {
    // Le graphe est déjà titré par le bloc qui l'accueille.
    grid: { left: 4, right: 12, top: 28, bottom: 4, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      itemHeight: 8,
      itemWidth: 12,
      icon: 'roundRect',
      textStyle: { color: ink2, fontFamily: font, fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      // Le compte brut plutôt que le pourcentage : c'est la question qu'on se
      // pose devant la barre (« combien de chapitres restent à écrire ? »).
      formatter: (params) => {
        const lines = params
          .filter((p) => p.data.count > 0)
          .map((p) => `${p.marker} ${p.seriesName} — ${p.data.count}`)
        return [`<strong>${params[0].axisValueLabel}</strong>`, ...lines].join('<br>')
      },
    },
    xAxis: {
      type: 'value',
      max: 100,
      show: false, // toutes les barres font 100 % : une graduation ne dirait rien
    },
    yAxis: {
      type: 'category',
      inverse: true, // ordre du document, de haut en bas
      data: rows.map((r) => `${r.titre}  (${r.leafCount})`),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ink, fontFamily: font, fontSize: 12 },
    },
    series: statuses.map((status, i) => ({
      name: status,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 22,
      data: pointsFor(rows, i),
      itemStyle: {
        color: cssVar(COLOR_TOKENS[status]),
        // Séparateur de 2 px à la couleur de la surface entre deux segments :
        // deux parts voisines de la rampe se touchent sinon, et la frontière
        // devient illisible (elles ne diffèrent que par la clarté).
        borderColor: surface,
        borderWidth: 2,
      },
      label: {
        show: true,
        // Étiquette directe : l'identité d'un segment ne doit jamais reposer
        // sur la seule couleur. Masquée sous 8 % de la barre, où le chiffre ne
        // tiendrait pas — légende et infobulle prennent le relais.
        formatter: ({ data }) => (data.value >= 8 ? `${data.count}` : ''),
        color: LIGHT_FILLS.includes(status) ? ink : '#fff',
        fontFamily: font,
        fontSize: 11,
      },
    })),
  }
})
</script>
