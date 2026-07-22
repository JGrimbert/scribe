import UiNote from './UiNote.vue'

export default {
  title: 'Atoms/UiNote',
  component: UiNote,
}

const render = (label) => (args) => ({
  components: { UiNote },
  setup: () => ({ args }),
  template: `<UiNote v-bind="args">${label}</UiNote>`,
})

export const State = {
  args: { variant: 'state' },
  render: render('Analyse pas encore calculée pour ce document.'),
}

export const Error = {
  args: { variant: 'error' },
  render: render('Échec : service NLP injoignable (HTTP 503).'),
}

export const Hint = {
  args: { variant: 'hint' },
  render: render('Chaque point est un segment de ~250 mots, placé par proximité sémantique.'),
}
