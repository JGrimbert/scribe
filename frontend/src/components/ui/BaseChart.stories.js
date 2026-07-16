import BaseChart from './BaseChart.vue'

export default {
  title: 'Atoms/BaseChart',
  component: BaseChart,
}

// Rampe ordinale de base.css (--c-ramp-1..4), en dur ici : Storybook rend hors
// du contexte d'un composant métier, où les tokens sont résolus par le
// consommateur (cf. CompletenessChart).
const RAMP = ['#cbb08a', '#b08a4f', '#8a5c2c', '#5a3418']
const STATUSES = ['vide', 'ébauche', 'partiel', 'rédigé']

const stacked = (rows) => ({
  grid: { left: 90, right: 16, top: 8, bottom: 24 },
  xAxis: { type: 'value' },
  yAxis: { type: 'category', data: rows.map((r) => r.titre) },
  series: STATUSES.map((status, i) => ({
    name: status,
    type: 'bar',
    stack: 'total',
    data: rows.map((r) => r.counts[i]),
    itemStyle: { color: RAMP[i] },
  })),
})

export const BarresEmpilees = {
  args: {
    option: stacked([
      { titre: 'Axe I', counts: [1, 2, 4, 9] },
      { titre: 'Axe II', counts: [5, 6, 2, 1] },
      { titre: 'Total', counts: [6, 8, 6, 10] },
    ]),
  },
}

// Une seule barre : vérifie que le graphe ne s'étire pas jusqu'à devenir un
// bandeau quand il n'y a qu'un axe.
export const UneSeuleBarre = {
  args: {
    option: stacked([{ titre: 'Total', counts: [2, 3, 1, 8] }]),
  },
}

export const Vide = {
  args: {
    option: stacked([{ titre: 'Total', counts: [0, 0, 0, 0] }]),
  },
}
