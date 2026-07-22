import UiCard from '../ui/molecules/UiCard.vue'
import BaseChip from '../ui/atoms/BaseChip.vue'
import '../../assets/base.css'
import '../../assets/analyse.css'

// Primitif de layout `.split` (analyse.css) partagé par les deux blocs du
// dashboard d'analyse : un cadre réunissant une viz principale (2/3,
// `.split-main`) et une colonne étroite (1/3). L'orientation encode le côté de
// la colonne étroite — `right` (bloc-nuage) ou `left` (bloc lexical, inverse) —
// via l'ordre DOM + la classe `.split-right` / `.split-left`. Padding et
// séparateurs viennent des tokens --split-pad / --split-pad-aside. Contenu
// factice : ni store ni d3.

export default {
  title: 'Organisms/Split',
  argTypes: {
    orientation: {
      control: 'inline-radio',
      options: ['right', 'left'],
      description: 'Côté de la colonne étroite (1/3)',
    },
  },
  args: { orientation: 'right' },
}

const CLOUD = [
  ['mémoire', 44, 'var(--c-cat-1)'], ['temps', 38, 'var(--c-cat-2)'], ['silence', 30, 'var(--c-cat-3)'],
  ['visage', 26, 'var(--c-cat-4)'], ['lumière', 34, 'var(--c-cat-1)'], ['ombre', 22, 'var(--c-cat-5)'],
  ['ville', 28, 'var(--c-cat-2)'], ['enfance', 24, 'var(--c-cat-6)'], ['route', 30, 'var(--c-cat-3)'],
  ['nuit', 32, 'var(--c-cat-2)'], ['rêve', 28, 'var(--c-cat-4)'], ['père', 22, 'var(--c-cat-5)'],
]

// Viz « qui remplit » (nuage) : l'enfant de .split-main prend `flex: 1` et
// occupe toute la colonne. Une viz brute (SVG du réseau) s'y centrerait.
const viz = `
  <div class="split-main">
    <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:0.15em 0.7em; flex:1; min-height:16em; font-family:var(--font-serif);">
      <span v-for="([w, size, color]) in CLOUD" :key="w" :style="{ fontSize: size + 'px', color }">{{ w }}</span>
    </div>
  </div>
`

const aside = (klass) => `
  <div class="${klass}">
    <UiCard bare title="Occurrences">
      <p style="margin:0 0 0.6em; font-size:var(--fs-sm); opacity:0.6;">« mémoire » — 87 occurrences sur 24 articles</p>
      <div style="display:flex; flex-wrap:wrap; gap:0.4em;">
        <BaseChip :active="true" :count="12">Chapitre III</BaseChip>
        <BaseChip :count="9">L’atelier</BaseChip>
        <BaseChip :count="7">Retour</BaseChip>
      </div>
    </UiCard>
    <UiCard bare title="Proximité sémantique">
      <p style="margin:0 0 0.5em; font-size:var(--fs-sm); opacity:0.6;">Articles proches de « Chapitre III »</p>
      <p style="margin:0; font-size:var(--fs-sm);">Retour · L’atelier · La gare…</p>
    </UiCard>
  </div>
`

export const Split = {
  render: (args) => ({
    components: { UiCard, BaseChip },
    setup: () => ({ args, CLOUD }),
    template: `
      <div class="split" style="max-width: 1000px;">
        <template v-if="args.orientation === 'left'">
          ${aside('split-left')}
          ${viz}
        </template>
        <template v-else>
          ${viz}
          ${aside('split-right')}
        </template>
      </div>
    `,
  }),
}
