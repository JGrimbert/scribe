import ScoreBar from './ScoreBar.vue'

export default {
  title: 'Atoms/ScoreBar',
  component: ScoreBar,
}

export const Simple = {
  args: { pct: 72 },
}

export const AvecLabel = {
  args: { pct: 72, label: '72,4 %' },
}

export const Progression = {
  args: { pct: 35, label: 'embeddings (35 %)', trackWidth: '16em' },
}

export const Extremes = {
  render: () => ({
    components: { ScoreBar },
    template: `
      <div style="display: flex; flex-direction: column; gap: 0.5em;">
        <ScoreBar :pct="0" label="0 %" />
        <ScoreBar :pct="50" label="50 %" />
        <ScoreBar :pct="100" label="100 %" />
        <ScoreBar :pct="140" label="clampé à 100" />
      </div>
    `,
  }),
}
