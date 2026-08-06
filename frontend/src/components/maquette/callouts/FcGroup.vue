<template>
  <div class="fc-grp" :class="classes" :style="{ left: `${x}px`, top: `${y}px` }">
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
})

const classes = computed(() => ({
  'fc-grp--left': props.side === 'left',
  'fc-grp--mid': props.anchor === 'mid',
  'fc-grp--bottom': props.anchor === 'bottom',
}))
</script>
