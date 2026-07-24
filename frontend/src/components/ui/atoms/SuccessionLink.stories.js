import { ref } from 'vue'
import SuccessionLink from './SuccessionLink.vue'

export default {
  title: 'Atoms/SuccessionLink',
  component: SuccessionLink,
}

// La puce est faite pour chevaucher une bordure entre deux lignes : ici elle est
// posée seule, sur fond papier, pour lire sa forme (oblong scindé + checkbox).
export const Simple = {
  render: () => ({
    components: { SuccessionLink },
    setup: () => ({ on: ref(false) }),
    template: `
      <div style="display:flex; align-items:center; gap:1rem;">
        <SuccessionLink :active="on" title="Exiger la succession" @toggle="on = !on" />
        <span style="font-size:0.85rem; opacity:0.6;">active : {{ on }}</span>
      </div>
    `,
  }),
}

export const States = {
  render: () => ({
    components: { SuccessionLink },
    template: `
      <div style="display:flex; gap:2rem; align-items:center;">
        <label style="display:flex; flex-direction:column; gap:0.5rem; align-items:center; font-size:0.8rem;">
          <SuccessionLink :active="false" /> inactif
        </label>
        <label style="display:flex; flex-direction:column; gap:0.5rem; align-items:center; font-size:0.8rem;">
          <SuccessionLink :active="true" /> actif (lien)
        </label>
      </div>
    `,
  }),
}
