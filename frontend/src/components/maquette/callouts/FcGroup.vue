<template>
  <div class="fc-grp" :class="classes" :style="style">
    <slot />
  </div>
</template>

<script setup>
// Conteneur positionné d'un callout de format : left/top en px + ancrage par classe
// (côté rail + point de ferrage vertical). La géométrie vient de l'hôte ; ici, rien
// que du placement — le contenu (cotes, bandes) passe par le slot.
import { computed } from 'vue'
import './callouts.css'

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  side: { type: String, default: 'right' }, // 'left' | 'right'
  anchor: { type: String, default: 'top' }, // 'top' | 'mid' | 'bottom'
  // Largeur du RAIL (px) : du point de ferrage au bord de l'aperçu. La pile n'a
  // pas le droit d'en sortir — au-delà elle passerait sous le sommaire ou hors du
  // champ. Les rows s'y comprimeront (nom de style en ellipse, selects rétrécis).
  maxWidth: { type: Number, default: null },
})

const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  ...(props.maxWidth != null ? { maxWidth: `${Math.max(props.maxWidth, 0)}px` } : {}),
}))

const classes = computed(() => ({
  'fc-grp--left': props.side === 'left',
  'fc-grp--mid': props.anchor === 'mid',
  'fc-grp--bottom': props.anchor === 'bottom',
}))
</script>
