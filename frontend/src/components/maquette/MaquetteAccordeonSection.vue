<template>
  <!-- UNE zone de la pellicule : son onglet-jalon ET ses vis-à-vis dans la même
       balise. La zone est posée par un translate (offset), ses feuillets par un
       translate local — tout est transform, donc animable au pli/dépli (un `left`
       en em, lui, sauterait). -->
  <div class="maq-section" :class="{ 'is-collapsed': collapsed }" :style="{ transform: `translateX(${offset.toFixed(3)}em)` }">
    <!-- Onglet d'entrée : étiquette NUE posée dans l'intervalle de tête (jamais
         sur un feuillet), et bouton de pli de la zone. -->
    <button
        type="button"
        class="maq-jalon"
        :class="{ 'is-active': active }"
        :style="jalonStyle"
        :aria-expanded="!collapsed"
        :title="collapsed ? 'Déplier' : 'Plier'"
        @click="$emit('toggle')"
    >
      <span class="maq-jalon__name">{{ label }}</span>
    </button>

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
  collapsed: { type: Boolean, default: false },
  // Zone du cran focusé → son onglet est appuyé.
  active: { type: Boolean, default: false },
  dropSpan: { type: Number, default: 2 },
})

defineEmits(['toggle', 'focus-cran'])

const ACC_DROP = 10

// Retrait EN Y : plafonné à `dropSpan` crans d'écart avec le focus (l'escalier
// s'arrête, l'écart horizontal suffit ensuite à distinguer les crans).
function dropOf(index) {
  return Math.min(Math.abs(index - props.focused), props.dropSpan) * ACC_DROP
}

function cranStyle(item, i) {
  const x = props.headGap + props.cardWidth / 2 + i * props.step
  const scale = item.index === props.focused ? 1 : 0.75
  return {
    transform: `translateX(${x.toFixed(3)}em) translateX(-50%) translateY(${dropOf(item.index)}px) scale(${scale})`,
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
   le long de la pellicule (les zones qui précèdent changent de largeur au pli). */
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

/* Onglet d'entrée de zone : étiquette NUE (ni cadre ni fond), au premier plan de
   sa zone, centrée dans l'intervalle qui la précède. Bouton → pli/dépli. */
.maq-jalon {
  position: absolute;
  top: 2.4em;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.4em;
  height: 10.5em;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

/* Nom vertical lisible de BAS EN HAUT (vertical-rl + rotation 180°). Grisé au repos ;
   la couleur seule (pas la graisse) distingue la zone focusée. */
.maq-jalon__name {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  font-size: var(--fs-xs);
  font-weight: 500;
  letter-spacing: 0.05em;
  white-space: nowrap;
  color: var(--c-muted);
  transition: color 0.2s ease;
}

.maq-jalon:hover .maq-jalon__name {
  color: var(--c-ink2);
}

/* Zone focusée : étiquette en bleu (accent-alt, un peu plus clair). */
.maq-jalon.is-active .maq-jalon__name {
  color: var(--c-accent-alt);
}
</style>
