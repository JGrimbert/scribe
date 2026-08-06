<template>
  <!-- Bande activable : case à cocher + champ « auto » + contrôle(s) optionnel(s)
       via le slot (ex. justification). Le champ et le slot sont FRÈRES du label,
       pas dedans : cliquer dessus ne bascule pas la case. `measureRef` est posé sur
       le label (l'intitulé) — c'est de LUI que part la fuyante, pas du bas de la
       colonne. Le slot reçoit `disabled` pour se griser en cohérence. -->
  <div class="fc-row"
       @mouseenter="$emit('hover', hoverKey)" @mouseleave="$emit('hover', null)">
    <label :ref="measureRef">
      <span class="fc-row__label">
        <input type="checkbox" v-model="band.enabled" /> {{ label }}
      </span>
    </label>
    <NumInput :value="value" :step="step" :unit="unit" placeholder="auto"
              :disabled="!band.enabled" @input="$emit('input', $event)" />
    <slot :disabled="!band.enabled" />
  </div>
</template>

<script setup>
import NumInput from '../NumInput.vue'
import './callouts.css'

// `band` : l'objet réactif (header/footer/manchette), muté EN PLACE — la case
// bascule `band.enabled` directement, même contrat que `styleDefaults`.
defineProps({
  band: { type: Object, required: true },
  label: { type: String, required: true },
  value: { type: [Number, String], default: null },
  step: { type: Number, default: 1 },
  unit: { type: String, default: '' },
  hoverKey: { type: String, default: null },
  measureRef: { type: Function, default: null },
})
defineEmits(['hover', 'input'])
</script>
