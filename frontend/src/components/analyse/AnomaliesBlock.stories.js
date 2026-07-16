import { provide, reactive, ref } from 'vue'
import AnomaliesBlock from './AnomaliesBlock.vue'
import { ANALYSE_KEY } from '../../composables/useAnalyse'
import '../../assets/base.css'
import '../../assets/analyse.css'

// Bloc anomalies : avancement de la rédaction (echarts) + les deux tables qui
// le détaillent. Store factice injecté (ANALYSE_KEY) plutôt qu'AnalyseView —
// ni routeur, ni fetch. Les deux moitiés du bloc ont des dépendances
// différentes (complétude = gratuite, doublons = NLP), d'où les états mixtes
// ci-dessous.

export default {
  title: 'Organisms/AnomaliesBlock',
}

const AXES = [
  { titre: 'I. Le seuil', counts: [0, 1, 3, 8] },
  { titre: 'II. La traversée', counts: [4, 5, 2, 1] },
  { titre: 'III. Le retour', counts: [1, 0, 2, 6] },
]

const STATUSES = ['vide', 'ébauche', 'partiel', 'rédigé']

const slices = (counts) => STATUSES.map((status, i) => ({ status, count: counts[i] }))

const completeness = () => {
  const groups = AXES.map((axe, i) => ({
    nodeId: `axe-${i}`,
    titre: axe.titre,
    leafCount: axe.counts.reduce((a, b) => a + b, 0),
    distribution: slices(axe.counts),
  }))
  const totals = STATUSES.map((_, i) => AXES.reduce((sum, a) => sum + a.counts[i], 0))
  return {
    threshold: 50,
    leafCount: totals.reduce((a, b) => a + b, 0),
    anomalies: [
      { nodeId: 'n1', titre: 'Le passeur', words: 0, status: 'vide' },
      { nodeId: 'n2', titre: 'La rive nord', words: 12, status: 'ébauche' },
      { nodeId: 'n3', titre: 'Les mains vides', words: 41, status: 'ébauche' },
    ],
    distribution: [
      ...groups,
      { nodeId: null, titre: 'Total', leafCount: totals.reduce((a, b) => a + b, 0), distribution: slices(totals) },
    ],
  }
}

// Deux paires au-delà du seuil de duplication (0,995).
const semantic = () => ({
  units: [
    { nodeId: 'n2', titre: 'La rive nord', neighbors: [{ nodeId: 'n4', score: 0.9992 }] },
    { nodeId: 'n4', titre: 'La rive sud', neighbors: [{ nodeId: 'n2', score: 0.9992 }] },
    { nodeId: 'n5', titre: 'Gabarit A', neighbors: [{ nodeId: 'n6', score: 0.9975 }] },
    { nodeId: 'n6', titre: 'Gabarit B', neighbors: [{ nodeId: 'n5', score: 0.9975 }] },
  ],
})

const fakeStore = ({ analysis, running = null, error = null }) => ({
  analysis: ref(analysis),
  running: ref(running),
  stepErrors: reactive({ lexical: null, semantic: error, topics: null }),
  topicsProgress: ref(null),
  focusNodeId: ref(null),
  isRevealed: () => true,
  settle: () => {},
  runStep: () => {},
  goToNode: () => {},
})

const render = (args) => ({
  components: { AnomaliesBlock },
  setup: () => {
    provide(ANALYSE_KEY, fakeStore(args))
  },
  template: `<div style="max-width: 1100px;"><AnomaliesBlock /></div>`,
})

export const Complet = {
  render,
  args: { analysis: { completeness: completeness(), semantic: semantic() } },
}

// Le cas normal à l'arrivée sur le dashboard : le graphe et les chapitres en
// attente s'affichent tout de suite, la table des doublons attend le NLP.
export const SansNlp = {
  render,
  args: { analysis: { completeness: completeness(), semantic: null } },
}

export const NlpEnCours = {
  render,
  args: { analysis: { completeness: completeness(), semantic: null }, running: 'semantic' },
}

export const NlpEnErreur = {
  render,
  args: {
    analysis: { completeness: completeness(), semantic: null },
    error: 'Échec : service NLP injoignable (503)',
  },
}

// Document sans aucun chapitre à situer : le bloc n'a pas de graphe à montrer.
export const AucunChapitre = {
  render,
  args: {
    analysis: { completeness: { threshold: 50, leafCount: 0, anomalies: [], distribution: [] }, semantic: null },
  },
}
