import BaseChip from './BaseChip.vue'

export default {
  title: 'Atoms/BaseChip',
  component: BaseChip,
}

const render = (label) => (args) => ({
  components: { BaseChip },
  setup: () => ({ args }),
  template: `<BaseChip v-bind="args">${label}</BaseChip>`,
})

export const Simple = {
  args: {},
  render: render('Margot'),
}

export const AvecCompteur = {
  args: { count: 220 },
  render: render('Margot'),
}

export const Active = {
  args: { count: 220, active: true },
  render: render('Margot'),
}

export const AvecPastille = {
  args: { count: 64, dot: '#2a78d6' },
  render: render('mémoire · lieu · trace'),
}

export const Groupe = {
  render: () => ({
    components: { BaseChip },
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 0.4em;">
        <BaseChip :count="220" active>Margot</BaseChip>
        <BaseChip :count="27">Katia</BaseChip>
        <BaseChip :count="23">Benjamin</BaseChip>
        <BaseChip :count="14">Laurent</BaseChip>
      </div>
    `,
  }),
}
