<template>
  <!-- Cadre commun d'un bloc du dashboard : révélation, spinner, états
       vide/erreur/lancement et colonnes 2/3 · 1/3. Les cards n'apportent que
       leur contenu (#main = la viz, #aside = la colonne étroite). -->
  <Transition name="reveal" :appear="!!step">
    <div v-if="!step || isRevealed(step)" class="split">
      <i v-if="busy" class="pi pi-spin pi-spinner split-busy"></i>

      <!-- Rien à montrer : message pleine largeur, pas de colonnes. -->
      <div v-if="!ready" class="split-message">
        <UiNote v-if="stepError" variant="error">{{ stepError }}</UiNote>

        <ScoreBar
            v-if="busy && topicsProgress"
            class="split-progress"
            :pct="topicsProgress.pct"
            :label="`${topicsProgress.step} (${Math.round(topicsProgress.pct)} %)`"
            track-width="16em"
        />
        <template v-else-if="!busy && !hasAnalysis">
          <UiNote>
            Analyse pas encore calculée. Nécessite le service NLP local (<code>npm run dev:nlp</code>) —
            {{ runHint }}
          </UiNote>
          <BaseButton
              variant="outline"
              icon="pi-play"
              :busy="!!running"
              class="split-run"
              @click="runStep(needs)"
          >
            {{ runLabel }}
          </BaseButton>
        </template>
        <UiNote v-else-if="!busy && unavailable" variant="hint">{{ unavailable }}</UiNote>
      </div>

      <template v-else>
        <div v-if="aside === 'left'" class="split-left"><slot name="aside" /></div>
        <div class="split-main"><slot name="main" /></div>
        <div v-if="aside === 'right'" class="split-right"><slot name="aside" /></div>
      </template>
    </div>
  </Transition>
</template>

<script setup>
import { computed, watch } from 'vue'
import UiNote from '../ui/UiNote.vue'
import ScoreBar from '../ui/ScoreBar.vue'
import BaseButton from '../ui/BaseButton.vue'
import { DASHBOARD_STEPS, useAnalyse } from '../../composables/useAnalyse'

const props = defineProps({
  // Clé de révélation (DASHBOARD_STEPS). Absente : le cadre est monté d'emblée
  // et ses enfants gèrent leur propre révélation (cas du bloc-nuage, qui en
  // enchaîne trois dans un seul cadre).
  step: { type: String, default: null },
  // Analyse backend dont dépend le bloc ; déduite de `step` par défaut.
  // Absente (et sans step) : le bloc est du pur layout, sans état vide.
  needs: { type: String, default: null },
  // Le contenu est-il affichable ? (données présentes ET viz calculable)
  ready: { type: Boolean, default: true },
  aside: { type: String, default: 'right', validator: (v) => ['left', 'right'].includes(v) },
  runLabel: { type: String, default: null },
  // Fin de la phrase du message « pas encore calculée » (durée attendue…).
  runHint: { type: String, default: null },
  // Note affichée quand l'analyse existe mais pas cette viz-là.
  unavailable: { type: String, default: null },
})

const { analysis, running, stepErrors, topicsProgress, isRevealed, settle, runStep } = useAnalyse()

const needs = computed(
  () => props.needs ?? DASHBOARD_STEPS.find((s) => s.key === props.step)?.needs ?? null,
)

const busy = computed(() => !!needs.value && running.value === needs.value)
const stepError = computed(() => (needs.value ? stepErrors[needs.value] : null))
const hasAnalysis = computed(() => !needs.value || !!analysis.value?.[needs.value])

// Le cadre est monté d'emblée (symétrie des blocs) : on relaie à la chaîne de
// révélation au moment où le contenu apparaît, pas au montage.
watch(
  () => props.step && isRevealed(props.step),
  (revealed) => { if (revealed) settle(props.step) },
  { immediate: true },
)
</script>

<style scoped>
.split {
  position: relative;
}

.split-busy {
  position: absolute;
  top: 0.7em;
  right: 0.9em;
  font-size: 0.85em;
  color: var(--c-accent);
}

.split-message {
  flex: 1;
  padding: var(--split-pad);
}

.split-progress {
  padding: 0.5em 0;
}

.split-run {
  margin-top: 0.75em;
}
</style>
