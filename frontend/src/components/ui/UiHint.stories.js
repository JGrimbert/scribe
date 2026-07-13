import UiHint from './UiHint.vue'

export default {
  title: 'Atoms/UiHint',
  component: UiHint,
}

export const Simple = {
  args: {
    text: 'Occurrences : nombre de fois qu’un mot apparaît dans le texte.',
  },
}

// Usage typique : à la suite d'une ligne / d'une liste, avec du texte autour.
export const EnLigne = {
  render: () => ({
    components: { UiHint },
    template: `
      <span style="display: inline-flex; align-items: center; gap: 0.4em; font-size: var(--fs-xs); opacity: 0.7;">
        mots distincts · occurrences · part du texte
        <UiHint text="Mots distincts : taille du vocabulaire (formes de base). Occurrences : apparitions au fil du texte. Part : pourcentage des mots du texte." />
      </span>
    `,
  }),
}
