import { ref } from 'vue'
import BaseToggle from './BaseToggle.vue'

export default {
  title: 'Atoms/BaseToggle',
  component: BaseToggle,
}

export const Simple = {
  render: () => ({
    components: { BaseToggle },
    setup: () => ({ on: ref(true) }),
    template: `
      <BaseToggle v-model="on" />
      <p style="margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.6;">v-model : {{ on }}</p>
    `,
  }),
}

// « muted » : grisé mais toujours cliquable (état « suit le défaut » — cliquer pose
// une valeur explicite). À distinguer de `disabled`, inerte.
export const States = {
  render: () => ({
    components: { BaseToggle },
    setup: () => ({ a: ref(false), b: ref(true) }),
    template: `
      <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem;">
        <label style="display:flex; gap:0.5rem; align-items:center;"><BaseToggle v-model="a" /> normal (off)</label>
        <label style="display:flex; gap:0.5rem; align-items:center;"><BaseToggle v-model="b" /> normal (on)</label>
        <label style="display:flex; gap:0.5rem; align-items:center;"><BaseToggle :model-value="true" muted /> muted (cliquable)</label>
        <label style="display:flex; gap:0.5rem; align-items:center;"><BaseToggle :model-value="false" disabled /> disabled (inerte)</label>
      </div>
    `,
  }),
}
