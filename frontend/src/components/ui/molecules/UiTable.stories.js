import UiTable from './UiTable.vue'
import ScoreBar from '../atoms/ScoreBar.vue'

export default {
  title: 'Molecules/UiTable',
  component: UiTable,
}

export const Simple = {
  render: () => ({
    components: { UiTable },
    template: `
      <UiTable>
        <thead>
          <tr><th>Article</th><th class="num">Mots</th><th class="num">Phrases</th></tr>
        </thead>
        <tbody>
          <tr class="row-link"><td>L'Aube</td><td class="num">42</td><td class="num">4</td></tr>
          <tr class="row-link"><td>Le Désamour</td><td class="num">107</td><td class="num">6</td></tr>
          <tr class="row-link"><td>L'Éclipse</td><td class="num">194</td><td class="num">13</td></tr>
        </tbody>
      </UiTable>
    `,
  }),
}

export const AvecScoreBar = {
  render: () => ({
    components: { UiTable, ScoreBar },
    template: `
      <UiTable>
        <thead>
          <tr><th>Article proche</th><th class="score-col">Proximité</th></tr>
        </thead>
        <tbody>
          <tr class="row-link"><td>Les Sembrunes</td><td class="score-col"><ScoreBar :pct="72" label="72,1 %" /></td></tr>
          <tr class="row-link"><td>La Sidence</td><td class="score-col"><ScoreBar :pct="52" label="52,0 %" /></td></tr>
        </tbody>
      </UiTable>
    `,
  }),
}

export const Flat = {
  render: () => ({
    components: { UiTable },
    template: `
      <UiTable flat>
        <thead>
          <tr><th>Article</th><th class="num">Mots</th><th class="num">Phrases</th></tr>
        </thead>
        <tbody>
          <tr class="row-link"><td>L'Aube</td><td class="num">42</td><td class="num">4</td></tr>
          <tr class="row-link"><td>Le Désamour</td><td class="num">107</td><td class="num">6</td></tr>
          <tr class="row-link"><td>L'Éclipse</td><td class="num">194</td><td class="num">13</td></tr>
        </tbody>
      </UiTable>
    `,
  }),
}

export const AvecScroll = {
  render: () => ({
    components: { UiTable },
    setup: () => ({ rows: Array.from({ length: 60 }, (_, i) => i + 1) }),
    template: `
      <UiTable scroll>
        <thead>
          <tr><th>Article</th><th class="num">Mots</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r" class="row-link"><td>Article {{ r }}</td><td class="num">{{ r * 37 }}</td></tr>
        </tbody>
      </UiTable>
    `,
  }),
}
