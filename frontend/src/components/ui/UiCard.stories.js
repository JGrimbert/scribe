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
