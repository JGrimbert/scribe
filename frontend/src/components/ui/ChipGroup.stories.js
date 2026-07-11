import ChipGroup from './ChipGroup.vue'
import BaseChip from './BaseChip.vue'

export default {
  title: 'Molecules/ChipGroup',
  component: ChipGroup,
}

export const Personnes = {
  render: () => ({
    components: { ChipGroup, BaseChip },
    template: `
      <ChipGroup title="Personnes" meta="63, 4 affichées">
        <BaseChip :count="220" active>Margot</BaseChip>
        <BaseChip :count="27">Katia</BaseChip>
        <BaseChip :count="23">Benjamin</BaseChip>
        <BaseChip :count="14">Laurent</BaseChip>
      </ChipGroup>
    `,
  }),
}

export const SansTitre = {
  render: () => ({
    components: { ChipGroup, BaseChip },
    template: `
      <ChipGroup>
        <BaseChip :count="64" dot="#2a78d6">mémoire · lieu · trace</BaseChip>
        <BaseChip :count="41" dot="#1baf7a">margot · amour · nuit</BaseChip>
        <BaseChip :count="28" dot="#eda100">jeu · règle · monde</BaseChip>
      </ChipGroup>
    `,
  }),
}
