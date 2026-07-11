import BaseButton from './BaseButton.vue'

export default {
  title: 'Atoms/BaseButton',
  component: BaseButton,
  argTypes: {
    variant: { control: 'select', options: ['accent', 'solid', 'outline', 'ghost'] },
  },
}

const render = (label) => (args) => ({
  components: { BaseButton },
  setup: () => ({ args }),
  template: `<BaseButton v-bind="args">${label}</BaseButton>`,
})

export const Accent = {
  args: { variant: 'accent', icon: 'pi-play' },
  render: render('Lancer les analyses'),
}

export const Solid = {
  args: { variant: 'solid' },
  render: render("Valider l'import"),
}

export const Outline = {
  args: { variant: 'outline' },
  render: render('Ouvrir'),
}

export const GhostIcone = {
  args: { variant: 'ghost', icon: 'pi-chart-bar' },
  render: render(''),
}

export const GhostActif = {
  args: { variant: 'ghost', icon: 'pi-chart-bar', active: true },
  render: render(''),
}

export const Busy = {
  args: { variant: 'accent', busy: true },
  render: render('Analyse en cours…'),
}

export const Disabled = {
  args: { variant: 'solid', disabled: true },
  render: render("Valider l'import"),
}
