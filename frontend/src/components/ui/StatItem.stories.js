import StatItem from './StatItem.vue'

export default {
  title: 'Atoms/StatItem',
  component: StatItem,
}

export const Simple = {
  args: { value: '105 329', label: 'mots' },
}

export const Bandeau = {
  render: () => ({
    components: { StatItem },
    template: `
      <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.4em 1.7em;">
        <StatItem value="105 329" label="mots" />
        <StatItem value="6 865" label="phrases" />
        <StatItem value="10 855" label="lemmes uniques" />
        <StatItem value="15,34" label="mots / phrase" />
        <StatItem value="10,3 %" label="diversité (TTR)" />
        <StatItem value="53,3 %" label="densité lexicale" />
      </div>
    `,
  }),
}
