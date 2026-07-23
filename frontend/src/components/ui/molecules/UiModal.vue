<template>
  <!-- Chrome de modale générique : voile clair + panneau flouté + bandeau titré.
       `open` est distinct du contenu — la modale peut s'ouvrir AVANT que son
       corps n'arrive (attente d'un fetch), le slot restant vide entre-temps.
       Backdrop et Échap ferment (émettent `close`) ; l'hôte détient `open`. -->
  <div
      v-if="open"
      class="ui-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      :style="{ '--ui-modal-top-bars': topBars }"
  >
    <div class="ui-modal__backdrop" @click="$emit('close')"></div>
    <div class="ui-modal__panel" :style="{ '--ui-modal-width': maxWidth, '--ui-modal-height': height }">
      <header class="ui-modal__head">
        <h3>{{ title }}</h3>
        <!-- Le mode d'emploi passe en pastille : il se consulte, il n'occupe pas
             une ligne à chaque ouverture. -->
        <UiHint v-if="hint" :text="hint" />
        <button type="button" class="ui-modal__close" title="Fermer" @click="$emit('close')">
          <i class="pi pi-times"></i>
        </button>
      </header>

      <div class="ui-modal__body">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, toRefs } from 'vue'
import UiHint from '../atoms/UiHint.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  // Pastille « ? » à côté du titre. Absente = pas de pastille.
  hint: { type: String, default: null },
  // Le panneau a une taille de TRAVAIL stable (pas seulement bornée au viewport) :
  // une modale à la mesure de son contenu redevient le plein écran qu'on fuit.
  maxWidth: { type: String, default: '62em' },
  height: { type: String, default: '34em' },
  // Nombre de barres fixes à dégager en haut (topbar seule = 1 ; +doc-bar = 2),
  // pour que leur fil d'Ariane reste lisible à travers le voile.
  topBars: { type: Number, default: 1 },
})

const emit = defineEmits(['close'])
const { open } = toRefs(props)

// Échap ferme. Posé sur `window` : le focus peut être n'importe où dans le corps
// (un accordéon entier), un handler local ne verrait pas la touche.
function onEscape(event) {
  if (event.key === 'Escape' && open.value) emit('close')
}
onMounted(() => window.addEventListener('keydown', onEscape))
onUnmounted(() => window.removeEventListener('keydown', onEscape))
</script>

<style scoped>
/* `z-index` AU-DESSUS des barres (topbar, doc-bar) : le voile doit les recouvrir
   avec leurs actions — un bouton encore vif sous la modale invite à une
   opération contradictoire. Le panneau, lui, reste calé SOUS elles (padding-top),
   qui gardent ainsi leur fil d'Ariane lisible à travers le voile. */
.ui-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--bar-size) * var(--ui-modal-top-bars, 1) + var(--sp-4)) var(--sp-4) var(--sp-4);
}

/* Voile CLAIR, pas un assombrissement : le panneau floute ce qu'il a derrière,
   donc un overlay noir se retrouvait mélangé dans sa propre teinte et salissait
   son blanc. Un blanc très dilué + un flou léger détachent l'arrière-plan sans
   le teindre. */
.ui-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(2px);
}

/* `height` et non `max-height` : un corps posé en absolu (liste de calibration)
   ne « pousse » pas le panneau — sans hauteur à distribuer, tout s'effondrait à
   quelques pixels. Le panneau ne peint AUCUN fond : il ne porte que le flou, le
   cadre et l'ombre. Ses deux sections (bandeau, corps) posent chacune le leur —
   un fond ici s'y ajouterait, deux couches translucides dont la teinte n'est
   plus celle qu'on a écrite. `overflow: hidden` fait suivre au fond des sections
   l'arrondi du cadre. */
.ui-modal__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, var(--ui-modal-width, 62em));
  height: min(100%, var(--ui-modal-height, 34em));
  backdrop-filter: blur(10px);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

/* Reprend la signature de la doc-bar (fond teinté, filet) : même famille de
   surface. Les tokens `--c-doc-bar-*` sont posés par `base.css` via
   `[data-bar-theme]` — repli teal hors de ce contexte (modale montée au niveau
   de l'app). Pas de `backdrop-filter` ici : le panneau floute déjà. */
.ui-modal__head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  background: var(--c-doc-bar-bck, rgba(142, 212, 225, 0.3));
  border-bottom: var(--c-doc-bar-border, 1px solid var(--c-accent-alt));
}

.ui-modal__head h3 {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 600;
}

/* Pousse la croix à droite — le `?` reste collé au titre qu'il explique. */
.ui-modal__close {
  margin-left: auto;
  border: 0;
  background: none;
  color: var(--c-ink2);
  font: inherit;
  cursor: pointer;
}

.ui-modal__close:hover { color: var(--c-accent); }

/* Le CORPS : blanc translucide, distinct du bandeau teinté ; c'est lui qui porte
   le padding du contenu (le panneau n'en a pas, sinon le bandeau ne pourrait
   pas aller d'un bord à l'autre). 0,45 et non 0,62 : au-delà, le corps composite
   à un blanc que des lignes claires ne peuvent plus quitter. Flex colonne pour
   qu'un corps flexible (calibration) s'y étende et fasse défiler sa seule liste. */
.ui-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.45);
  padding: var(--sp-4);
}
</style>
