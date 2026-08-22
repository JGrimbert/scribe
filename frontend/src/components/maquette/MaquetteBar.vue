<template>
  <div class="maq-bar">
    <label class="maq-search">
      <i class="pi pi-search maq-search__icon"></i>
      <input
          ref="inputEl"
          v-model="query"
          type="search"
          class="maq-search__input"
          placeholder="Rechercher…"
          @focus="$emit('focus-search')"
      />
    </label>

    <div v-if="tallyRow" class="maq-tally">
      <span class="maq-tally__level">n°{{ tallyRow.index + 1 }}</span>
      <span
          class="maq-tally__pct"
          :title="`${tallyRow.validables} validables · ${tallyRow.valides} validés / ${tallyRow.total}`"
      >{{ pct }} %</span>

      <button
          type="button"
          class="maq-tally__action"
          :class="{ 'maq-tally__action--on': validating }"
          :aria-pressed="validating"
          :title="validating ? 'Fermer la validation' : 'Valider ce niveau'"
          @click="$emit('validate')"
      >
        <i class="pi pi-check-square" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Mode de présentation (chapitrage uniquement) -->
    <div v-if="isChapitrage" class="maq-mode">
      <label class="maq-mode__label">Mode</label>
      <BaseSelect
          :model-value="presentationMode"
          @update:model-value="$emit('update:presentation-mode', $event)"
      >
        <option value="standard">Standard</option>
        <option value="visualization">Visualisation</option>
      </BaseSelect>
    </div>

    <button
        type="button"
        class="maq-recal"
        :disabled="!recalibratable"
        :title="recalibratableTitle"
        @click="$emit('recalibrate')"
    >
      <i class="pi pi-refresh" aria-hidden="true"></i>
      <span>Redéfinir les bornes</span>
    </button>

    <label class="maq-bar__zoom">
      <span>Dézoom</span>

      <BaseSelect :model-value="zoom" @update:model-value="$emit('update:zoom', Number($event))">
        <option v-for="z in zooms" :key="z" :value="z">×{{ z }}</option>
      </BaseSelect>
    </label>
  </div>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'

const props = defineProps({
  zoom: { type: Number, required: true },
  zooms: { type: Array, required: true },
  tallyRow: { type: Object, default: null },
  validating: { type: Boolean, default: false },
  recalibratable: { type: Boolean, default: true },
  searching: { type: Boolean, default: false },
  isChapitrage: { type: Boolean, default: false },
  presentationMode: { type: String, default: 'standard' },
})

const emit = defineEmits([
  'update:zoom', 'update:query', 'validate', 'recalibrate', 'focus-search', 'exit-search',
  'update:presentation-mode',
])

const recalibratableTitle = computed(() =>
  props.recalibratable
    ? 'Relire le .odt d\'origine et redéfinir les bornes'
    : 'Recalibrage impossible : le .odt d\'origine n\'a pas été conservé (document importé avant cette fonctionnalité). Seul un réimport permet de refixer les bornes.',
)

const pct = computed(() => {
  const r = props.tallyRow
  return r?.total ? Math.round((r.validables / r.total) * 100) : 0
})

const query = ref('')
const inputEl = ref(null)

watch(query, (q) => emit('update:query', q))

function onDocKeydown(e) {
  if (e.key !== 'Escape') return
  query.value = ''
  inputEl.value?.blur()
  emit('exit-search')
}

watch(() => props.searching, (isOpen) => {
  document[isOpen ? 'addEventListener' : 'removeEventListener']('keydown', onDocKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onDocKeydown))
</script>

<style scoped>
.maq-bar {
  border-bottom: 4px solid #e3dccd;
  position: absolute;
  top: var(--bar-size-2);
  left: 0;
  right: 0;
  height: var(--bar-size);
  z-index: 170;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding-left: calc(2em + var(--sp-3));
  padding-right: 1em;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
  background: color-mix(in srgb, var(--c-floral-5) 78%, transparent);
  backdrop-filter: blur(2px) saturate(110%);
  -webkit-backdrop-filter: blur(2px) saturate(110%);
  box-shadow:
      0 1px 2px var(--c-shadow-1),
      0 2px 6px var(--c-shadow-2);
}

.maq-search {
  flex: 0 1 26em;
  display: flex;
  align-items: center;
  gap: 1em;
}

.maq-search__icon {
  flex: 0 0 auto;
  font-size: .8em;
  color: var(--c-accent-alt-darker);
  -webkit-text-stroke: 0.6px currentColor;
}

.maq-search__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
}

.maq-search__input:focus {
  outline: none;
}

.maq-search__input::placeholder {
  color: inherit;
  opacity: var(--op-faint);
}

.maq-search__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.maq-tally {
  margin-left: auto;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.maq-tally__level {
  opacity: var(--op-muted);
}

.maq-tally__pct {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: default;
}

.maq-tally__action {
  display: flex;
  align-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0.2em 0.35em;
  border-radius: var(--radius-sm);
  font-size: var(--fs-md);
}

.maq-tally__action:hover {
  color: var(--c-accent-alt);
}

.maq-tally__action--on {
  color: var(--c-accent-alt);
  background: color-mix(in srgb, var(--c-accent-alt) 12%, transparent);
}

/* Mode selector : positionné avant recalibrage, border-radius légère */
.maq-mode {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.maq-mode__label {
  opacity: var(--op-muted);
  font-size: var(--fs-sm);
}

.maq-recal {
  margin-left: auto;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
  padding: 0.25em 0.6em;
  cursor: pointer;
}

.maq-recal:hover:not(:disabled) {
  border-color: var(--c-accent-alt);
  color: var(--c-accent-alt);
}

.maq-recal:disabled {
  opacity: var(--op-faint);
  cursor: default;
}

.maq-bar__zoom {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
</style>
