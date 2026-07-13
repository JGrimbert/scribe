import ProgressChecklist from '../ui/ProgressChecklist.vue'
import StatItem from '../ui/StatItem.vue'
import BaseButton from '../ui/BaseButton.vue'
import UiCard from '../ui/UiCard.vue'
import BaseChip from '../ui/BaseChip.vue'

// Story « en contexte » : elle ne monte pas AnalyseView (routeur + store + fetch
// + d3), mais rejoue la mise en page du haut du dashboard avec des composants
// ui réels + un faux nuage, pour juger la barre de chargement dans son
// environnement (débordement sur le nuage, largeur bornée à 65 %, cadre marron).

export default {
  title: 'Organisms/AnalyseTop',
}

const LABELS = ['Fréquence', 'Occurrences', 'Proximité', 'Lexicale', 'Thématiques', 'Similarités']
const withStatus = (statuses) => LABELS.map((label, i) => ({ label, status: statuses[i] }))

const STATS = [
  { label: 'caractères', value: '486 210' },
  { label: 'mots', value: '82 034' },
  { label: 'phrases', value: '5 129' },
  { label: 'paragraphes', value: '1 942' },
  { label: 'chapitres', value: '61' },
  { label: 'lemmes', value: '9 771' },
  { label: 'diversité', value: '31 %' },
  { label: 'densité', value: '54 %' },
]

// Faux nuage : quelques mots en serif, tailles/teintes variées, pour donner le
// fond réel par-dessus lequel la barre flotte.
const CLOUD = [
  ['mémoire', 44, '#0e7183'], ['temps', 38, '#1b8496'], ['silence', 30, '#3f97a4'],
  ['visage', 26, '#5aa6b0'], ['lumière', 34, '#166f80'], ['ombre', 22, '#7fb6bd'],
  ['ville', 28, '#2f8d9c'], ['enfance', 24, '#63a9b2'], ['fenêtre', 20, '#93c1c6'],
  ['route', 30, '#227e8f'], ['main', 18, '#a8ccd0'], ['ciel', 26, '#4d9ea9'],
  ['nuit', 32, '#1b8496'], ['père', 22, '#7fb6bd'], ['rêve', 28, '#3f97a4'],
]

const render = (args) => ({
  components: { ProgressChecklist, StatItem, BaseButton, UiCard, BaseChip },
  setup: () => ({ args, STATS, CLOUD }),
  template: `
    <div style="padding: 1.25em; max-width: 1100px;">
      <div style="display:flex; flex-wrap:wrap; align-items:stretch; gap:0.6em; margin-bottom:1em;">
        <StatItem v-for="s in STATS" :key="s.label" :value="s.value" :label="s.label" style="flex:1 1 8em;" />
        <BaseButton variant="solid-alt" icon="pi-play" style="flex:1 1 8em; justify-content:center;">
          Relancer l’analyse
        </BaseButton>
      </div>

      <!-- Slot de hauteur nulle : la barre flotte sans réserver d'espace. -->
      <div style="position:relative;">
        <div style="position:absolute; top:0.6em; left:0.6em; width:calc(65% - 1.2em); z-index:2;">
          <ProgressChecklist :items="args.items" :progress="args.progress" />
        </div>
      </div>

      <div style="display:flex; align-items:flex-start; gap:1em; margin-bottom:1em;">
        <!-- Faux nuage (colonne gauche, ~2/3) -->
        <div style="flex:2 1 0; min-width:0;">
          <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:0.15em 0.7em; padding:0.5em; min-height:260px; font-family:var(--font-serif);">
            <span v-for="([w, size, color]) in CLOUD" :key="w" :style="{ fontSize: size + 'px', color }">{{ w }}</span>
          </div>
        </div>

        <!-- Colonne droite (~1/3) : cards latérales -->
        <div style="flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:1em;">
          <UiCard title="Occurrences">
            <p style="margin:0 0 0.6em; font-size:var(--fs-sm); opacity:0.6;">« mémoire » — 87 occurrences sur 24 articles</p>
            <div style="display:flex; flex-wrap:wrap; gap:0.4em;">
              <BaseChip :active="true" :count="12">Chapitre III</BaseChip>
              <BaseChip :count="9">L’atelier</BaseChip>
              <BaseChip :count="7">Retour</BaseChip>
              <BaseChip :count="5">La gare</BaseChip>
            </div>
          </UiCard>
          <UiCard title="Proximité sémantique">
            <p style="margin:0.25em 0 0.5em; font-size:var(--fs-sm); opacity:0.6;">Articles proches de « Chapitre III »</p>
            <p style="margin:0; font-size:var(--fs-sm);">Retour · L’atelier · La gare…</p>
          </UiCard>
        </div>
      </div>
    </div>
  `,
})

export const PendantChargement = {
  render,
  args: {
    items: withStatus(['done', 'done', 'running', 'pending', 'pending', 'pending']),
    progress: null,
  },
}

export const AvecProgression = {
  render,
  args: {
    items: withStatus(['done', 'done', 'done', 'done', 'running', 'pending']),
    progress: { pct: 42, label: 'extraction des thèmes (42 %)' },
  },
}

export const Termine = {
  render,
  args: {
    items: withStatus(['done', 'done', 'done', 'done', 'done', 'done']),
    progress: null,
  },
}
