<template>
  <!-- Cote simple : intitulé + un champ. `measureRef` re-expose le DOM mesuré à
       l'hôte (fuyantes SVG) ; le survol remonte la clé de zone (ou null). -->
  <div class="fc-row" :ref="measureRef"
       @mouseenter="$emit('hover', hoverKey)" @mouseleave="$emit('hover', null)">
    <span class="fc-row__label">{{ label }}</span>
    <NumInput :value="value" :step="step" :unit="unit" @input="$emit('input', $event)" />
  </div>
</template>

<script setup>
import NumInput from '../NumInput.vue'
import './callouts.css'

defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: null },
  step: { type: Number, default: 1 },
  unit: { type: String, default: '' },
  hoverKey: { type: String, default: null },
  measureRef: { type: Function, default: null },
})
defineEmits(['hover', 'input'])
</script>
