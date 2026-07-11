import { ref } from 'vue'
import TreeRow from './TreeRow.vue'

export default {
  title: 'Molecules/TreeRow',
  component: TreeRow,
}

export const SidebarListe = {
  render: () => ({
    components: { TreeRow },
    setup: () => ({ open: ref(true) }),
    template: `
      <div style="max-width: 260px;">
        <TreeRow variant="list" expandable :expanded="open" normalize-case @toggle="open = !open">LA LISIÈRE</TreeRow>
        <div v-if="open" style="margin-left: 0.9em; padding-left: 0.35em; border-left: 1px dashed var(--c-border);">
          <TreeRow variant="list" expandable normalize-case>Sylvestres</TreeRow>
          <TreeRow variant="list" current normalize-case>l'aube</TreeRow>
          <TreeRow variant="list" normalize-case>Le Désamour</TreeRow>
        </div>
      </div>
    `,
  }),
}

export const AvecTrailing = {
  render: () => ({
    components: { TreeRow },
    template: `
      <div style="max-width: 420px;">
        <TreeRow variant="list" expandable normalize-case>
          La Lisière
          <template #trailing>
            <span style="width: 5.2em; text-align: right; font-size: 0.8em; opacity: 0.6; font-variant-numeric: tabular-nums;">60</span>
            <span style="width: 5.2em; text-align: right; font-size: 0.8em; opacity: 0.6; font-variant-numeric: tabular-nums;">14 424</span>
          </template>
        </TreeRow>
      </div>
    `,
  }),
}

export const CalibrationCard = {
  render: () => ({
    components: { TreeRow },
    template: `
      <div style="max-width: 60ch;">
        <TreeRow variant="card" expandable accent-color="#6366f1">
          CYCLE 1 — l'enfance
          <template #trailing><span style="font-size: 0.75em; opacity: 0.5;">7 sous-titres</span></template>
        </TreeRow>
        <TreeRow variant="card" accent-color="#22c55e">Naissance BenJ</TreeRow>
      </div>
    `,
  }),
}
