import StatItem from './StatItem.vue'

export default {
  title: 'Atoms/StatItem',
  component: StatItem,
}

export const Simple = {
  args: { value: '105 329', label: 'mots' },
}

// Le bandeau du dashboard : une tuile par stat.
export const Bandeau = {
  render: () => ({
    components: { StatItem },
    template: `
      <div style="display: flex; align-items: stretch; flex-wrap: wrap; gap: 0.6em;">
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
