import UiCard from './UiCard.vue'
import UiNote from './UiNote.vue'

export default {
  title: 'Molecules/UiCard',
  component: UiCard,
}

export const Simple = {
  args: { title: 'Vocabulaire' },
  render: (args) => ({
    components: { UiCard },
    setup: () => ({ args }),
    template: `
      <UiCard v-bind="args">
        <h3>Une section</h3>
        <p>Contenu de la card.</p>
      </UiCard>
    `,
  }),
}

// Sans titre : en-tête non rendu, le contenu occupe toute la card (ex : nuage).
export const SansTitre = {
  args: {},
  render: (args) => ({
    components: { UiCard },
    setup: () => ({ args }),
    template: `
      <UiCard v-bind="args">
        <p>Card sans en-tête.</p>
      </UiCard>
    `,
  }),
}

export const Busy = {
  args: { title: 'Analyse linguistique', busy: true },
  render: (args) => ({
    components: { UiCard, UiNote },
    setup: () => ({ args }),
    template: `
      <UiCard v-bind="args">
        <UiNote variant="state">Analyse en cours — le contenu précédent reste affiché.</UiNote>
      </UiCard>
    `,
  }),
}
