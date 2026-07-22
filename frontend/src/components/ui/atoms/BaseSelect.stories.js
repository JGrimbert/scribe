import { ref } from 'vue'
import BaseSelect from './BaseSelect.vue'

export default {
  title: 'Atoms/BaseSelect',
  component: BaseSelect,
}

export const Simple = {
  render: () => ({
    components: { BaseSelect },
    setup: () => ({ choix: ref('aube') }),
    template: `
      <BaseSelect v-model="choix">
        <option value="aube">L'Aube</option>
        <option value="desamour">Le Désamour</option>
        <option value="eclipse">L'Éclipse</option>
      </BaseSelect>
      <p style="margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.6;">v-model : {{ choix }}</p>
    `,
  }),
}
