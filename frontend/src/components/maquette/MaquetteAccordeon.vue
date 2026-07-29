<template>
  <!-- Pellicule générique : une suite de vis-à-vis (l'unité de focus) qui se
       chevauchent en profondeur, seul le focusé à pleine taille (les autres à
       0.75, OPAQUES — plus de désaturation). Les vis-à-vis sont regroupés en
       SÉRIES ; chaque série est introduite par un onglet-jalon (marqueur
       informatif, sans action). L'onglet de la série focusée est ÉPINGLÉ (ni
       échelle ni retrait) ; son drapeau déborde hors de l'onglet. La liste plate
       des crans arrive déjà construite (chaque cran porte sa série). -->
  <div class="maq-accordeon">
    <div class="maq-stage" @wheel.prevent="onWheel">
      <div class="maq-backdrop" aria-hidden="true"></div>

      <!-- Vis-à-vis. Le rendu de la cellule est délégué au parent (une source
           décide de son contenu) ; défaut = vis-à-vis nu. L'accordéon ne porte
           que la scène (position / échelle / profondeur). -->
      <div
          v-for="(cran, i) in crans"
          :key="`s${i}`"
          class="maq-cran"
          :class="{ 'is-focused': i === focused }"
          :style="accStyle(i)"
          @click="$emit('update:focused', i)"
      >
        <slot name="spread" :cran="cran">
          <MaquetteSpreadCell />
        </slot>
      </div>

      <!-- Onglets d'entrée de série : nom à la verticale, drapeau débordant au-
           dessus. Épinglés quand leur série est focusée. Rendus APRÈS les crans
           pour passer au premier plan. -->
      <div
          v-for="tab in seriesTabs"
          :key="`j${tab.startIndex}`"
          class="maq-jalon"
          :class="{ 'is-active': tab.seriesIndex === focusedSeries }"
          :style="jalonStyle(tab.startIndex)"
      >
        <i class="pi pi-flag-fill maq-jalon__flag" aria-hidden="true"></i>
        <span class="maq-jalon__name">{{ tab.label }}</span>
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
  // Liste PLATE des vis-à-vis dans l'ordre de lecture. Chaque cran porte sa source
  // (`sourceKey`) ET sa série (`seriesIndex`/`seriesLabel`/`isSeriesStart`). La
  // ventilation en séries vit chez le parent.
  crans: { type: Array, required: true },
  focused: { type: Number, required: true },
  // Plafond du retrait EN Y : au-delà de `dropSpan` crans d'écart avec le focus,
  // on ne descend plus (l'escalier s'arrête). L'écart HORIZONTAL, borné par le
  // conteneur, suffit à distinguer les crans qui se chevauchent.
  dropSpan: { type: Number, default: 2 },
})

const emit = defineEmits(['update:focused'])

const ACC_DROP = 10

// Série du cran focusé → son onglet est épinglé.
const focusedSeries = computed(() => props.crans[props.focused]?.seriesIndex ?? 0)

// Un onglet par série, ancré sur son PREMIER vis-à-vis (isSeriesStart).
const seriesTabs = computed(() =>
  props.crans
    .map((c, i) => ({ seriesIndex: c.seriesIndex, label: c.seriesLabel, isSeriesStart: c.isSeriesStart, startIndex: i }))
    .filter((c) => c.isSeriesStart),
)

// Ancrage en largeur : le i-ème cran à i/(n-1) de la largeur, retranché d'autant
// de sa propre largeur — premier flush à gauche, dernier à droite. Sélectionner ne
// déplace rien (pas de recentrage), ça zoome sur place ; seuls l'escalier Y
// (plafonné) et la profondeur distinguent les crans qui se chevauchent.
function anchorT(i) {
  const n = props.crans.length
  return n > 1 ? i / (n - 1) : 0.5
}

function accStyle(i) {
  const t = anchorT(i)
  const dist = Math.abs(i - props.focused)
  const drop = Math.min(dist, props.dropSpan) * ACC_DROP
  const scale = i === props.focused ? 1 : 0.75
  return {
    left: `${t * 100}%`,
    transform: `translateX(-${t * 100}%) translateY(${drop}px) scale(${scale})`,
    zIndex: String(props.crans.length - dist),
  }
}

// L'onglet suit l'ancrage de son vis-à-vis d'ouverture. Épinglé (drop 0) quand sa
// série est focusée ; sinon il accompagne le retrait de cette ouverture.
function jalonStyle(startIndex) {
  const t = anchorT(startIndex)
  const pinned = props.crans[startIndex]?.seriesIndex === focusedSeries.value
  const dist = Math.abs(startIndex - props.focused)
  const drop = pinned ? 0 : Math.min(dist, props.dropSpan) * ACC_DROP
  return {
    left: `${t * 100}%`,
    transform: `translateX(-${t * 100}%) translateY(${drop}px)`,
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
  height: 15em;
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

/* Vis-à-vis : hauteur fixe (les cellules la remplissent, largeur au ratio de page
   → jamais de débordement vertical hors du stage). OPAQUE (plus de désaturation) ;
   seule l'échelle distingue les crans en retrait. Origine top-center pour que la
   réduction garde les pages alignées en tête. */
.maq-cran {
  position: absolute;
  top: 2.4em;
  height: 10.5em;
  cursor: pointer;
  transform-origin: top center;
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.13));

  &.is-focused {
    cursor: default;
  }
}

/* Onglet d'entrée de série : bande verticale fine, nom écrit à la verticale,
   drapeau débordant au-dessus. Au premier plan (au-dessus des vis-à-vis). */
.maq-jalon {
  position: absolute;
  top: 2.4em;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.9em;
  height: 10.5em;
  padding: 0.5em 0;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-accent-alt-darker) 8%, var(--c-surface));
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
  pointer-events: none;
}

/* Série focusée : onglet appuyé (repère de « on est ici »). */
.maq-jalon.is-active {
  background: var(--c-accent-alt);
  border-color: var(--c-accent-alt-darker);
}

.maq-jalon__name {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: var(--fs-xs);
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: var(--c-ink2);
}

.maq-jalon.is-active .maq-jalon__name {
  color: var(--c-surface);
}

/* Le drapeau dépasse HORS de l'onglet, au-dessus (dans la respiration du stage). */
.maq-jalon__flag {
  position: absolute;
  bottom: 100%;
  margin-bottom: 3px;
  font-size: var(--fs-sm);
  color: var(--c-accent-alt-darker);
}
</style>
