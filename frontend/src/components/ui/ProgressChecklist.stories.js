import ProgressChecklist from './ProgressChecklist.vue'

export default {
  title: 'Molecules/ProgressChecklist',
  component: ProgressChecklist,
}

// Les six étapes du dashboard d'analyse, réutilisées d'un état à l'autre.
const LABELS = ['Fréquence', 'Occurrences', 'Proximité', 'Lexicale', 'Thématiques', 'Similarités']

const withStatus = (statuses) => LABELS.map((label, i) => ({ label, status: statuses[i] }))

export const Initial = {
  args: {
    items: withStatus(['running', 'pending', 'pending', 'pending', 'pending', 'pending']),
  },
}

export const EnCours = {
  args: {
    items: withStatus(['done', 'done', 'running', 'pending', 'pending', 'pending']),
  },
}

export const AvecProgression = {
  args: {
    items: withStatus(['done', 'done', 'done', 'done', 'running', 'pending']),
    progress: { pct: 42, label: 'extraction des thèmes (42 %)' },
  },
}

export const Termine = {
  args: {
    items: withStatus(['done', 'done', 'done', 'done', 'done', 'done']),
  },
}

export const Indisponible = {
  args: {
    items: withStatus(['done', 'done', 'unavailable', 'done', 'unavailable', 'unavailable']),
  },
}

export const Erreur = {
  args: {
    items: withStatus(['done', 'done', 'error', 'done', 'unavailable', 'unavailable']),
  },
}

// Vue d'ensemble : tous les statuts empilés pour comparer l'espacement et les
// couleurs d'un coup d'œil.
export const TousLesEtats = {
  render: (args) => ({
    components: { ProgressChecklist },
    setup: () => ({ args }),
    template: `
      <div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
        <ProgressChecklist :items="args.initial" />
        <ProgressChecklist :items="args.enCours" />
        <ProgressChecklist :items="args.progression" :progress="args.progress" />
        <ProgressChecklist :items="args.termine" />
      </div>
    `,
  }),
  args: {
    initial: withStatus(['running', 'pending', 'pending', 'pending', 'pending', 'pending']),
    enCours: withStatus(['done', 'done', 'running', 'pending', 'pending', 'pending']),
    progression: withStatus(['done', 'done', 'done', 'done', 'running', 'pending']),
    progress: { pct: 42, label: 'extraction des thèmes (42 %)' },
    termine: withStatus(['done', 'done', 'done', 'done', 'done', 'done']),
  },
}
