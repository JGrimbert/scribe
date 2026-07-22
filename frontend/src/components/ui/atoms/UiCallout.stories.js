import UiCallout from './UiCallout.vue'
import ScoreBar from './ScoreBar.vue'

export default {
  title: 'Molecules/UiCallout',
  component: UiCallout,
}

export const Info = {
  render: (args) => ({
    components: { UiCallout },
    setup: () => ({ args }),
    template: `<UiCallout v-bind="args">Analyse pas encore calculée pour ce document.</UiCallout>`,
  }),
  args: { title: 'Info', tone: 'info' },
}

export const Erreur = {
  render: (args) => ({
    components: { UiCallout },
    setup: () => ({ args }),
    template: `<UiCallout v-bind="args">Service NLP injoignable (HTTP 503).</UiCallout>`,
  }),
  args: { title: 'Échec', tone: 'error' },
}

// Corps trop long pour la largeur disponible → tronqué avec « … ».
export const Tronque = {
  render: (args) => ({
    components: { UiCallout },
    setup: () => ({ args }),
    template: `
      <div style="max-width: 340px;">
        <UiCallout v-bind="args">Service NLP injoignable — HTTP 503 : le conteneur nlp-service ne répond pas sur le port 8001.</UiCallout>
      </div>
    `,
  }),
  args: { title: 'Échec', tone: 'error', truncate: true },
}

// Section détail (centrée, fond plus clair) : ici une barre de progression.
export const AvecDetail = {
  render: (args) => ({
    components: { UiCallout, ScoreBar },
    setup: () => ({ args }),
    template: `
      <UiCallout v-bind="args">
        Extraction des thèmes en cours…
        <template #detail><ScoreBar :pct="42" label="extraction (42 %)" track-width="16em" /></template>
      </UiCallout>
    `,
  }),
  args: { title: 'Chargement', tone: 'info' },
}

// Comparateur de teintes : même bloc, --tone forcé par style inline.
const CANDIDATES = [
  ['Ardoise', '#5f7089'],
  ['Prune', '#7d5c86'],
  ['Sauge', '#6f8069'],
]

export const TeintesCandidates = {
  render: () => ({
    components: { UiCallout },
    setup: () => ({ candidates: CANDIDATES }),
    template: `
      <div style="display:flex; flex-direction:column; gap:0.9em; align-items:flex-start;">
        <UiCallout v-for="([name, hex]) in candidates" :key="hex" :title="name" :style="{ '--tone': hex }">
          {{ name }} — {{ hex }} · info neutre / chargement
        </UiCallout>
        <UiCallout title="Échec" tone="error">Échec (rouge sémantique, inchangé)</UiCallout>
      </div>
    `,
  }),
}
