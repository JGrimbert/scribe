<template>
  <!-- Pellicule générique : une suite de crans qui se chevauchent en profondeur,
       seul le focusé est à pleine taille (les autres à 0.75). À la différence du
       liminaire, les crans ne sont pas tous des vis-à-vis : une SOURCE de contenu
       (série de vis-à-vis) est séparée de la suivante par un `acc-spread-jalon`,
       un cran d'action. La scène est purement présentationnelle — la liste plate
       des crans (spreads + jalons) arrive déjà construite. -->
  <div class="maq-accordeon">
    <div class="maq-stage" @wheel.prevent="onWheel">
      <div class="maq-backdrop" aria-hidden="true"></div>
      <div
          v-for="(cran, i) in crans"
          :key="i"
          class="maq-cran"
          :class="{ 'is-focused': i === focused, 'is-jalon': cran.kind === 'jalon' }"
          :style="accStyle(i)"
          @click="$emit('update:focused', i)"
      >
        <!-- La mention Verso/Recto ne coiffe QUE le vis-à-vis au premier plan.
             Hors flux (bottom: 100%) : elle ne pousse pas les folios. -->
        <div v-if="i === focused && cran.kind === 'spread'" class="maq-legend" aria-hidden="true">
          <span>Verso</span><span>Recto</span>
        </div>

        <template v-if="cran.kind === 'spread'">
          <!-- La cellule du vis-à-vis est déléguée au parent (une source décide de
               son rendu) ; défaut = vis-à-vis nu. L'accordéon ne porte que la
               scène (position/échelle/profondeur). -->
          <slot name="spread" :cran="cran">
            <MaquetteSpreadCell />
          </slot>
          <div class="maq-source-tag">{{ cran.label }}</div>
        </template>

        <!-- Jalon = frontière entre deux sources, un cran d'action (comme le cran
             terminal du liminaire). Placeholder tant que les sources ne sont pas
             câblées. -->
        <div v-else class="maq-jalon-card">
          <i class="pi pi-flag-fill" aria-hidden="true"></i>
          <span class="maq-jalon-label">{{ cran.label }}</span>
          <button type="button" class="maq-jalon-action" @click.stop>Action</button>
        </div>
      </div>
    </div>

    <AccordeonRail
        :focused="focused"
        :slide-count="crans.length"
        @update:focused="$emit('update:focused', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AccordeonRail from '../liminaire/AccordeonRail.vue'
import MaquetteSpreadCell from './MaquetteSpreadCell.vue'
import { useWheelStepper } from '../../composables/useWheelStepper'

const props = defineProps({
  // Liste PLATE des crans dans l'ordre de lecture : `{ kind: 'spread'|'jalon',
  // label, sourceKey? }`. La ventilation en sources vit chez le parent.
  crans: { type: Array, required: true },
  focused: { type: Number, required: true },
  // Plafond de la progression EN Y : au-delà de `dropSpan` crans d'écart avec le
  // focus, on ne descend plus (l'escalier s'arrête). L'espace HORIZONTAL, lui, est
  // borné par le conteneur (le dock, calé sur la zone main 2/3) : les crans
  // s'ancrent sur toute sa largeur, ce qui donne à chacun une position distincte —
  // c'est cet écart horizontal, pas l'escalier, qui rend le recouvrement lisible.
  dropSpan: { type: Number, default: 2 },
})

const emit = defineEmits(['update:focused'])

const ACC_DROP = 10
const ACC_DIM_MAX = 3

// Ancrage en largeur (comme le liminaire) : le i-ème cran à i/(n-1) de la largeur,
// retranché d'autant de sa propre largeur — premier flush à gauche, dernier à
// droite, les autres égrenés entre. Sélectionner ne déplace rien (pas de
// recentrage), ça zoome sur place ; seul l'escalier Y (plafonné) et la profondeur
// distinguent les crans qui se chevauchent.
function accStyle(i) {
  const n = props.crans.length
  const t = n > 1 ? i / (n - 1) : 0.5
  const dist = Math.abs(i - props.focused)
  const drop = Math.min(dist, props.dropSpan) * ACC_DROP
  const scale = i === props.focused ? 1 : 0.75
  return {
    left: `${t * 100}%`,
    transform: `translateX(-${t * 100}%) translateY(${drop}px) scale(${scale})`,
    zIndex: String(n - dist),
    '--acc-dim': String(Math.min(dist, ACC_DIM_MAX)),
  }
}

const { onWheel } = useWheelStepper({
  slideCount: computed(() => props.crans.length),
  focused: computed(() => props.focused),
  onStep: (next) => emit('update:focused', next),
})
</script>

<style scoped lang="scss">
.maq-accordeon {
  display: flex;
  flex-direction: column;
}

.maq-stage {
  position: relative;
  height: 14em;
  overflow: hidden;
}

.maq-backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(
      ellipse 66% 35% at 50% 99%,
      color-mix(in srgb, var(--c-accent-alt-darker) 6%, transparent),
      color-mix(in srgb, var(--c-accent-alt-darker) 6%, transparent) 45%,
      transparent 72%
  );
  pointer-events: none;
}

.maq-cran {
  position: absolute;
  top: 1.4em;
  width: min(20em, 100%);
  cursor: pointer;
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), filter 0.35s ease;
  filter:
      drop-shadow(0 2px 5px rgba(0, 0, 0, calc(0.13 - var(--acc-dim, 0) * 0.025)))
      saturate(calc(1 - var(--acc-dim, 0) * 0.18));

  &.is-focused {
    cursor: default;
  }

  &.is-jalon {
    width: min(12em, 100%);
  }
}

.maq-source-tag {
  margin-top: var(--sp-1);
  text-align: center;
  font-size: var(--fs-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--c-ink2);
}

.maq-legend {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: var(--sp-1);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  text-align: center;
  font-size: var(--fs-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--c-ink2);
}

.maq-jalon-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  height: 9em;
  padding: var(--sp-3);
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--c-accent-alt-darker) 5%, var(--c-surface));

  i {
    color: var(--c-accent-alt-darker);
    font-size: var(--fs-lg);
  }
}

.maq-jalon-label {
  text-align: center;
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}

.maq-jalon-action {
  margin-top: auto;
  padding: var(--sp-1) var(--sp-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface0);
  color: inherit;
  font: inherit;
  font-size: var(--fs-xs);
  cursor: pointer;
}
</style>
