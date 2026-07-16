import StackedBar from './StackedBar.vue'

export default {
  title: 'Atoms/StackedBar',
  component: StackedBar,
}

// Les zones d'un livre : une identité, pas une progression → palette
// catégorielle (--c-cat-*), jamais la rampe ordinale.
const zones = (liminaire, axes, blocs, articles, final) => [
  { key: 'liminaire', value: liminaire, color: 'var(--c-cat-1)', label: 'Liminaire' },
  { key: 'depth-0', value: axes, color: 'var(--c-cat-2)', label: 'Axes' },
  { key: 'depth-1', value: blocs, color: 'var(--c-cat-3)', label: 'Blocs sémantiques' },
  { key: 'depth-2+', value: articles, color: 'var(--c-cat-4)', label: 'Articles' },
  { key: 'final', value: final, color: 'var(--c-cat-5)', label: 'Partie finale' },
]

// Un style transverse : « Paragraphes » sur le manuscrit témoin.
export const Transverse = {
  args: { segments: zones(10, 0, 8, 1591, 0) },
}

// Un style signant : « Dédicace » ne vit que dans le liminaire — la barre le dit
// d'un coup d'œil, sans lire un chiffre.
export const MonoZone = {
  args: { segments: zones(1, 0, 0, 0, 0) },
}

export const Reparti = {
  args: { segments: zones(0, 27, 103, 248, 0), width: '12em' },
}

export const Vide = {
  args: { segments: zones(0, 0, 0, 0, 0) },
}

export const Comparaison = {
  render: () => ({
    components: { StackedBar },
    setup: () => ({ zones }),
    template: `
      <div style="display: flex; flex-direction: column; gap: 0.6em; font-size: 0.9em;">
        <div><StackedBar :segments="zones(1, 0, 0, 0, 0)" /> Dédicace</div>
        <div><StackedBar :segments="zones(0, 0, 0, 182, 0)" /> Voir</div>
        <div><StackedBar :segments="zones(10, 0, 8, 1591, 0)" /> Paragraphes</div>
        <div><StackedBar :segments="zones(0, 27, 103, 248, 0)" /> Text body</div>
      </div>
    `,
  }),
}
