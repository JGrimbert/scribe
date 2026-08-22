<template>
  <!-- Cote simple : intitulé + un champ. `measureRef` posé sur le LABEL (pas la row
       entière) → la fuyante vise le milieu de l'intitulé, comme FcBand. Le survol
       remonte la clé de zone (ou null). -->
  <div class="fc-row"
       @mouseenter="$emit('hover', hoverKey)" @mouseleave="$emit('hover', null)">
    <span class="fc-row__label" :ref="measureRef">{{ label }}</span>
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
