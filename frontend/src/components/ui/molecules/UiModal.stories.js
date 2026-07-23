import UiModal from './UiModal.vue'

export default {
  title: 'Molecules/UiModal',
  component: UiModal,
  args: { open: true, title: 'Redéfinir les bornes' },
}

export const Simple = {
  render: (args) => ({
    components: { UiModal },
    setup: () => ({ args }),
    template: `
      <UiModal v-bind="args" @close="args.open = false">
        <p>Contenu de la modale.</p>
      </UiModal>
    `,
  }),
}

// Avec pastille « ? » : le mode d'emploi se consulte, il n'occupe pas une ligne.
export const AvecHint = {
  args: {
    title: "Calibrage de l'import",
    hint: 'Posez le début du contenu et, s’il y en a une, la partie finale.',
  },
  render: (args) => ({
    components: { UiModal },
    setup: () => ({ args }),
    template: `
      <UiModal v-bind="args" @close="args.open = false">
        <p>La liste de calibration défilerait ici.</p>
      </UiModal>
    `,
  }),
}
