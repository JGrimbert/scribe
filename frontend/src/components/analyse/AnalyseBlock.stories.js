import { provide, reactive, ref } from 'vue'
import AnalyseBlock from './AnalyseBlock.vue'
import UiCard from '../ui/UiCard.vue'
import { ANALYSE_KEY } from '../../composables/useAnalyse'
import '../../assets/base.css'
import '../../assets/analyse.css'

// Cadre commun d'un bloc du dashboard : révélation, spinner, états
// vide/erreur/lancement, colonnes 2/3 · 1/3. La story injecte un store factice
// (ANALYSE_KEY) plutôt que de monter AnalyseView — ni routeur, ni fetch, ni d3.

export default {
  title: 'Organisms/AnalyseBlock',
  argTypes: {
    aside: { control: 'inline-radio', options: ['right', 'left'] },
  },
}

// Store minimal : uniquement ce que lit AnalyseBlock.
const fakeStore = ({ analysis = null, running = null, error = null, progress = null }) => ({
  analysis: ref(analysis),
  running: ref(running),
  stepErrors: reactive({ lexical: null, semantic: null, topics: error }),
  topicsProgress: ref(progress),
  isRevealed: () => true,
  settle: () => {},
  runStep: () => {},
})

const render = (args) => ({
  components: { AnalyseBlock, UiCard },
  setup: () => {
    provide(ANALYSE_KEY, fakeStore(args))
    return { args }
  },
  template: `
    <div style="max-width: 1000px;">
      <AnalyseBlock
          step="themes"
          :aside="args.aside"
          :ready="args.ready"
          run-label="Lancer l’analyse des thèmes"
          run-hint="l’extraction d’un manuscrit complet prend plusieurs minutes."
          unavailable="Carte des segments indisponible sur cette analyse — relancer l’analyse pour l’obtenir."
      >
        <template #main>
          <svg class="viz" viewBox="0 0 440 440" role="img" aria-label="Carte factice">
            <circle v-for="p in 60" :key="p"
                    :cx="20 + (p * 97) % 400" :cy="20 + (p * 53) % 400" r="4"
                    :fill="['#2a78d6','#1baf7a','#eda100','#e34948'][p % 4]" fill-opacity="0.85" />
          </svg>
        </template>
        <template #aside>
          <UiCard bare>
            <p class="card-lead">Thème « mémoire » — 128 segments (18 %)</p>
            <p style="margin:0; font-size:var(--fs-sm); font-family:var(--font-serif); color:var(--c-accent);">
              mémoire · enfance · visage · silence
            </p>
          </UiCard>
          <UiCard bare>
            <p class="card-lead">Présence par axe</p>
            <p style="margin:0; font-size:var(--fs-sm);">Première partie · Deuxième partie…</p>
          </UiCard>
        </template>
      </AnalyseBlock>
    </div>
  `,
})

export const Pret = {
  render,
  args: { aside: 'right', ready: true, analysis: { topics: {} } },
}

export const ColonneAGauche = {
  render,
  args: { aside: 'left', ready: true, analysis: { topics: {} } },
}

// Aucune analyse en base : note + bouton de lancement.
export const PasCalculee = {
  render,
  args: { aside: 'right', ready: false, analysis: null },
}

// Calcul en cours : spinner du cadre + avancement du job topics.
export const EnCours = {
  render,
  args: {
    aside: 'right',
    ready: false,
    analysis: null,
    running: 'topics',
    progress: { pct: 42, step: 'extraction des thèmes' },
  },
}

// Analyse présente mais viz absente (analyse d'une version antérieure).
export const VizIndisponible = {
  render,
  args: { aside: 'right', ready: false, analysis: { topics: {} } },
}

export const Erreur = {
  render,
  args: { aside: 'right', ready: false, analysis: null, error: 'Échec : service NLP injoignable (503)' },
}
