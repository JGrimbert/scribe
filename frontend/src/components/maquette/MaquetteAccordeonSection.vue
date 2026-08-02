<template>
  <!-- UNE zone de la pellicule : son onglet-jalon ET ses vis-à-vis dans la même
       balise. La zone est posée par un translate (offset), ses feuillets par un
       translate local — tout est transform, donc animable au pli/dépli (un `left`
       en em, lui, sauterait). -->
  <div class="maq-section" :class="`is-${level}`" :style="{ transform: `translateX(${offset.toFixed(3)}em)` }">
    <!-- Onglet d'entrée : posé dans l'intervalle de tête (jamais sur un feuillet),
         et bouton de pli de la zone (cycle des 3 niveaux). -->
    <MaquetteJalon
        :label="label"
        :active="active"
        :title="TITLES[level]"
        :style="jalonStyle"
        :aria-expanded="level === 'open'"
        @click="$emit('toggle')"
    />

    <!-- Vis-à-vis. Le rendu de la cellule est délégué au parent (une source décide
         de son contenu). -->
    <div
        v-for="(item, i) in items"
        :key="item.index"
        class="maq-cran"
        :class="{ 'is-focused': item.index === focused }"
        :style="cranStyle(item, i)"
        @click="$emit('focus-cran', item.index)"
    >
      <slot name="spread" :cran="item.cran" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MaquetteJalon from './MaquetteJalon.vue'

const props = defineProps({
  label: { type: String, default: '' },
  // Vis-à-vis de la zone : { cran, index } — `index` est l'index GLOBAL (unité de
  // focus côté parent), l'ordinal local sert à la géométrie.
  items: { type: Array, required: true },
  // Index global du cran focusé (peut désigner une autre zone : le retrait Y et
  // l'empilement se lisent sur la distance à ce focus).
  focused: { type: Number, required: true },
  // Position (em) du bord gauche de la zone le long de la pellicule.
  offset: { type: Number, required: true },
  // Largeur (em) d'un vis-à-vis et pas entre deux vis-à-vis : le pas se resserre
  // quand la zone est pliée (recouvrement 95 %).
  cardWidth: { type: Number, required: true },
  step: { type: Number, required: true },
  // Vide de tête de la zone : il isole la zone précédente ET accueille l'onglet.
  headGap: { type: Number, required: true },
  // Niveau de pli : 'open' (étalée) · 'stack' (empilée) · 'tab' (onglet seul).
  level: { type: String, default: 'open' },
  // Zone du cran focusé → son onglet est appuyé.
  active: { type: Boolean, default: false },
  dropSpan: { type: Number, default: 2 },
})

defineEmits(['toggle', 'focus-cran'])

const ACC_DROP = 10

// Zone réduite à son onglet : ses feuillets se ramènent contre lui (centre du
// premier à `TAB_ORIGIN` au lieu du vide de tête + une demi-largeur) et forment un
// bloc UNIFORME — retrait Y au plafond et échelle des crans en retrait, quel que
// soit le focus : la zone est refermée, elle n'a plus de cran mis en avant.
const TAB_ORIGIN = 7

// Infobulle du bouton : ce que fera le PROCHAIN clic (cycle open → stack → tab).
const TITLES = { open: 'Empiler', stack: 'Réduire à l’onglet', tab: 'Déplier' }

// Retrait EN Y : plafonné à `dropSpan` crans d'écart avec le focus (l'escalier
// s'arrête, l'écart horizontal suffit ensuite à distinguer les crans).
function dropOf(index) {
  return Math.min(Math.abs(index - props.focused), props.dropSpan) * ACC_DROP
}

function cranStyle(item, i) {
  const tab = props.level === 'tab'
  const x = (tab ? TAB_ORIGIN : props.headGap + props.cardWidth / 2) + i * props.step
  const drop = tab ? props.dropSpan * ACC_DROP : dropOf(item.index)
  const scale = !tab && item.index === props.focused ? 1 : 0.75
  return {
    transform: `translateX(${x.toFixed(3)}em) translateX(-50%) translateY(${drop}px) scale(${scale})`,
    // Empilement local à la zone (le transform de `.maq-section` en fait un
    // contexte d'empilement) : le plus proche du focus au-dessus — c'est ce qui
    // donne l'effet de pile quand la zone est pliée.
    zIndex: String(1000 - Math.abs(item.index - props.focused)),
  }
}

// L'onglet se pose au CENTRE du vide de tête et accompagne le retrait Y de la
// première page de sa zone. Pas d'échelle : une étiquette nue doit rester lisible.
const jalonStyle = computed(() => {
  const drop = props.items.length ? dropOf(props.items[0].index) : props.dropSpan * ACC_DROP
  return {
    transform: `translateX(${(props.headGap / 2).toFixed(3)}em) translateX(-50%) translateY(${drop}px)`,
  }
})
</script>

<style scoped lang="scss">
/* Zone : conteneur de positionnement de ses feuillets et de son onglet, glissé
   le long de la pellicule (les zones qui précèdent changent de largeur au pli).
   AUCUN z-index : son `transform` en fait un contexte d'empilement, et l'ordre du
   DOM suffit — chaque zone passe devant la précédente, ce qui est exactement le
   recouvrement attendu quand une zone est réduite à son onglet. */
.maq-section {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

/* Vis-à-vis : hauteur fixe (les cellules la remplissent, largeur au ratio de page
   → jamais de débordement vertical hors du stage). OPAQUE ; seule l'échelle
   distingue les crans en retrait. Origine top-center pour que la réduction garde
   les pages alignées en tête. */
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

/* L'onglet lui-même (position absolue, écriture verticale, couleurs) vit dans
   `MaquetteJalon` — partagé avec le panneau du dock. La zone ne fait que le
   décaler dans son intervalle de tête (`jalonStyle`). */
</style>
