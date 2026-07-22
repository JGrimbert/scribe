<template>
  <!-- Les vis-à-vis se chevauchent en profondeur, seul celui qui a le focus est
       à pleine taille (les autres à 0.75 → un tiers plus petit). Navigation SOUS
       la scène uniquement (flèches + pastilles), puis une réglette qui situe le
       vis-à-vis dans le liminaire.
       Le DERNIER cran n'est pas un vis-à-vis mais l'action d'étendre le
       liminaire — d'où `slideCount = spreads + 1` dans toute la mécanique. -->
  <div class="accordeon">
    <div class="acc-stage" @wheel.prevent="onWheel">
      <div class="acc-backdrop" aria-hidden="true"></div>
      <div
          v-for="(spread, si) in spreads"
          :key="si"
          class="acc-spread"
          :class="{ 'is-focused': si === focused }"
          :style="accStyle(si)"
          @click="$emit('update:focused', si)"
      >
        <!-- La mention ne coiffe QUE le vis-à-vis au premier plan, chaque mot
             centré sur sa page. Hors flux (bottom: 100%) : elle ne pousse pas
             les folios, sinon le focus se décalerait des autres. -->
        <div v-if="si === focused" class="acc-legend" aria-hidden="true">
          <span>Verso</span><span>Recto</span>
        </div>
        <div class="spread">
          <div
              v-for="(cell, ci) in [spread.left, spread.right]"
              :key="ci"
              class="folio-slot"
              :class="ci === 0 ? 'is-left' : 'is-right'"
          >
            <LiminaireFolio
                :cell="cell"
                :type="typeOfCell(cell)"
                :suggestion="suggestionOfCell(cell)"
            />
          </div>
        </div>

        <!-- Le DERNIER vis-à-vis borne le liminaire : c'est lui, et lui seul,
             qu'on peut rendre au corps du livre. Hors flux (top: 100%) pour la
             même raison que la mention Verso/Recto. -->
        <div v-if="si === focused && si === spreads.length - 1" class="acc-spread-action">
          <LimBorderButton
              icon="pi-arrow-up-right"
              :disabled="!borderShift"
              :title="borderShift
                ? 'Rendre le dernier chapitre absorbé au corps du livre'
                : 'Le liminaire d’origine s’arrête avant le premier titre : aucune borne ne peut le raccourcir'"
              @click.stop="$emit('exclude')"
          >
            Exclure du liminaire
          </LimBorderButton>
        </div>
      </div>

      <!-- Cran terminal : pas un vis-à-vis, une action. Le wrapper porte la
           position/échelle/focus (mécanique de scène) ; la carte vit dans
           AccordeonFinalSlide. -->
      <div
          class="acc-spread acc-spread--final"
          :class="{ 'is-focused': focused === spreads.length }"
          :style="accStyle(spreads.length)"
          @click="$emit('update:focused', spreads.length)"
      >
        <AccordeonFinalSlide
            :can-extend="canExtend"
            :next-title="nextTitle"
            :recalibratable="recalibratable"
            :starting="starting"
            :recal-error="recalError"
            @extend="$emit('extend')"
            @redefine="$emit('redefine')"
        />
      </div>
    </div>

    <AccordeonRail
        :focused="focused"
        :slide-count="slideCount"
        @update:focused="$emit('update:focused', $event)"
    />

    <AccordeonControls
        :spreads="spreads"
        :focused="focused"
        :types="types"
        :suggestions="suggestions"
        :sides="sides"
        :expected-sides="expectedSides"
        :conflicts="conflicts"
        @update:focused="$emit('update:focused', $event)"
        @set-type="(page, value) => $emit('set-type', page, value)"
        @set-side="(page, value) => $emit('set-side', page, value)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LiminaireFolio from './LiminaireFolio.vue'
import LimBorderButton from './LimBorderButton.vue'
import AccordeonRail from './AccordeonRail.vue'
import AccordeonControls from './AccordeonControls.vue'
import AccordeonFinalSlide from './AccordeonFinalSlide.vue'
import { useWheelStepper } from '../../composables/useWheelStepper'

const props = defineProps({
  // Les vis-à-vis d'imposition (cf. toSpreads). Purement présentationnel : les
  // types et suggestions arrivent résolus, ce composant ne lit pas la config.
  spreads: { type: Array, required: true },
  focused: { type: Number, required: true },
  // page.key → type posé, et page.key → suggestion en attente.
  types: { type: Object, required: true },
  suggestions: { type: Object, required: true },
  // page.key → côté choisi ('auto'|'recto'|'verso'), côté attendu par la
  // convention du type (ou null), et conflit entre les deux. Résolus par le
  // composer : ce composant ne lit pas la config.
  sides: { type: Object, default: () => ({}) },
  expectedSides: { type: Object, default: () => ({}) },
  conflicts: { type: Object, default: () => ({}) },
  recalibratable: { type: Boolean, default: true },
  starting: { type: Boolean, default: false },
  recalError: { type: String, default: null },
  borderShift: { type: Number, default: 0 },
  canExtend: { type: Boolean, default: true },
  nextTitle: { type: String, default: null },
})

const emit = defineEmits(['update:focused', 'set-type', 'set-side', 'extend', 'exclude', 'redefine'])

function typeOfCell(cell) {
  return cell?.page ? (props.types[cell.page.key] ?? '') : ''
}

function suggestionOfCell(cell) {
  return cell?.page ? (props.suggestions[cell.page.key] ?? null) : null
}

// Le cran terminal (l'action d'étendre) compte comme une position : les
// vis-à-vis occupent 0..n-1, l'action n.
const slideCount = computed(() => props.spreads.length + 1)

// Les crans s'ÉTALENT sur toute la largeur : le i-ème est ancré à i/(n-1) de la
// largeur et retranché d'autant de sa propre largeur — le premier colle à
// gauche, le dernier à droite, les autres s'égrènent entre les deux. Le
// chevauchement naît de ce que la largeur d'un vis-à-vis excède son pas.
// Aucun recentrage sur le focus : sélectionner ne déplace rien, ça ZOOME sur
// place (origine centrale). Aucune opacité non plus — les pages restent
// pleines, seule l'échelle et la profondeur les distinguent.
// Chaque cran d'éloignement DESCEND le vis-à-vis : l'escalier sépare des pages
// qui, alignées, se confondraient sous le chevauchement.
const ACC_DROP = 11

// Au-delà de ce rang, l'atténuation ne se creuse plus : sans plafond, les crans
// lointains d'un long liminaire finiraient délavés jusqu'à l'illisible.
const ACC_DIM_MAX = 3

function accStyle(i) {
  const n = slideCount.value
  const t = n > 1 ? i / (n - 1) : 0.5
  const dist = Math.abs(i - props.focused)
  const scale = i === props.focused ? 1 : 0.75
  return {
    left: `${t * 100}%`,
    transform: `translateX(-${t * 100}%) translateY(${dist * ACC_DROP}px) scale(${scale})`,
    zIndex: String(n - dist),
    // Consommé par le CSS (teinte + ombre) : l'éloignement est une donnée de
    // rang, le rendu qu'on en tire reste une affaire de feuille de style.
    '--acc-dim': String(Math.min(dist, ACC_DIM_MAX)),
  }
}

const { onWheel } = useWheelStepper({
  slideCount,
  focused: computed(() => props.focused),
  onStep: (next) => emit('update:focused', next),
})
</script>

<style scoped lang="scss">
/* Une planche = un livre ouvert : deux folios se rejoignant au centre. */
.spread {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: min(100%, 30em);
}

.folio-slot {
  display: flex;
}

/* La reliure : le bord intérieur (droite du verso, gauche du recto) plus
   marqué. Le folio est la racine d'un composant enfant → :deep(). */
.is-left :deep(.folio) { border-right-width: 2px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.is-right :deep(.folio) { border-left-width: 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; }

.accordeon {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md);
}

.acc {

  &-stage {
    position: relative;
    height: 22em;
    overflow: hidden;
/*    background-color: var(--c-aside-bck);
    padding: 1em 2em;*/
  }

  &-backdrop {
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

  &-spread {
    position: absolute;
    top: 1.7em;
    width: min(26em, 100%);
    cursor: pointer;
    transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), filter 0.35s ease;
    filter:
        drop-shadow(0 2px 5px rgba(0, 0, 0, calc(0.13 - var(--acc-dim, 0) * 0.025)))
        saturate(calc(1 - var(--acc-dim, 0) * 0.18))
        brightness(var(--acc-brightness));

      &.is-focused {
        cursor: default;
      }

      &-action {
        position: absolute;
        top: var(--sp-4);
        left: 0;
        right: 0;
        z-index: 2;
        display: flex;
        justify-content: center;
        pointer-events: none;

        /* LimBorderButton est un composant enfant → :deep() pour l'override. */
        :deep(.lim-border-btn) {
          pointer-events: auto;
          background: var(--c-surface0);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
        }

      }

    &--final {
      width: min(13em, 100%);
    }

  }

  &-legend {
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

}
</style>
