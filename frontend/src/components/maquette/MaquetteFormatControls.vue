<template>
  <!-- Contrôles du format de page, montés en TÊTE de l'aside (le main ne garde que
       le diagramme nu). Dimensions puis marges miroir, en champs normaux.
       `styleDefaults` est muté en place (comme dans la config). -->
  <div class="mfc">
    <div class="mfc-group">
      <label class="mfc-field mfc-field--grow">
        <span class="mfc-label">Dimensions</span>
        <BaseSelect v-model="selectedKey">
          <option value="">Original (.odt)</option>
          <option v-for="f in PAGE_FORMATS" :key="f.key" :value="f.key">{{ f.label }}</option>
          <option value="custom">Personnaliser…</option>
        </BaseSelect>
      </label>
      <label class="mfc-field mfc-field--unit">
        <span class="mfc-label">Unité</span>
        <BaseSelect v-model="unit">
          <option v-for="un in UNITS" :key="un.key" :value="un.key">{{ un.label }}</option>
        </BaseSelect>
      </label>
    </div>

    <div v-if="isCustom" class="mfc-dims">
      <label class="mfc-num">
        <span class="mfc-num-label">Largeur</span>
        <span class="mfc-input">
          <input type="number" min="0" :step="step" inputmode="decimal"
                 :value="toUnit(effective && effective.widthCm)"
                 @input="setDimension('widthCm', $event.target.value)" />
          <span class="mfc-unit">{{ unit }}</span>
        </span>
      </label>
      <label class="mfc-num">
        <span class="mfc-num-label">Hauteur</span>
        <span class="mfc-input">
          <input type="number" min="0" :step="step" inputmode="decimal"
                 :value="toUnit(effective && effective.heightCm)"
                 @input="setDimension('heightCm', $event.target.value)" />
          <span class="mfc-unit">{{ unit }}</span>
        </span>
      </label>
    </div>

    <div class="mfc-margins">
      <label v-for="m in MARGINS" :key="m.key" class="mfc-num">
        <span class="mfc-num-label">{{ m.label }}</span>
        <span class="mfc-input">
          <input type="number" min="0" :step="step" inputmode="decimal"
                 :value="toUnit(marginsView[m.key])"
                 @input="setMargin(m.key, $event.target.value)" />
          <span class="mfc-unit">{{ unit }}</span>
        </span>
      </label>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import { PAGE_FORMATS, effectiveMargins, effectivePage, matchFormat } from '../../script/pageFormats'

const props = defineProps({
  // PageFormat du .odt (cf. backend/odt-parser).
  page: { type: Object, default: null },
  // Muté en place (pageSize, pageMargins), détenu par le parent.
  styleDefaults: { type: Object, required: true },
})

// « petit fond » = intérieur (reliure), « grand fond » = extérieur.
const MARGINS = [
  { key: 'topCm', label: 'Blanc de tête' },
  { key: 'bottomCm', label: 'Blanc de pied' },
  { key: 'innerCm', label: 'Petit fond' },
  { key: 'outerCm', label: 'Grand fond' },
]

// Unité d'affichage : le modèle reste en cm, converti à la volée.
const UNITS = [
  { key: 'mm', label: 'mm', perCm: 10, dec: 1 },
  { key: 'cm', label: 'cm', perCm: 1, dec: 2 },
  { key: 'in', label: 'in', perCm: 1 / 2.54, dec: 3 },
  { key: 'pt', label: 'pt', perCm: 72 / 2.54, dec: 1 },
]
const unit = ref('cm')
const u = computed(() => UNITS.find((x) => x.key === unit.value) ?? UNITS[1])
const step = computed(() => (unit.value === 'mm' || unit.value === 'pt' ? 1 : 0.1))

function toUnit(cm) {
  if (cm == null || cm === false) return ''
  const f = 10 ** u.value.dec
  return Math.round(cm * u.value.perCm * f) / f
}
function fromUnit(raw) {
  const n = Number(String(raw).trim())
  return Number.isFinite(n) ? n / u.value.perCm : null
}

const effective = computed(() => effectivePage(props.page, props.styleDefaults.pageSize))
const marginsView = computed(() => effectiveMargins(props.page, props.styleDefaults.pageMargins))

// Le select stocke des DIMENSIONS (pas un nom de format) ; « custom » = hors des
// formats connus.
const selectedKey = computed({
  get() {
    const ps = props.styleDefaults.pageSize
    if (!ps) return ''
    return matchFormat(ps.widthCm, ps.heightCm)?.key ?? 'custom'
  },
  set(key) {
    if (key === '') {
      props.styleDefaults.pageSize = null
    } else if (key === 'custom') {
      const base = effective.value ?? { widthCm: 14.8, heightCm: 21 }
      props.styleDefaults.pageSize = { widthCm: base.widthCm, heightCm: base.heightCm }
    } else {
      const f = PAGE_FORMATS.find((x) => x.key === key)
      if (f) props.styleDefaults.pageSize = { widthCm: f.widthCm, heightCm: f.heightCm }
    }
  },
})
const isCustom = computed(() => selectedKey.value === 'custom')

function setDimension(key, raw) {
  const cm = fromUnit(raw)
  if (cm == null || cm <= 0) return
  if (!props.styleDefaults.pageSize) {
    const base = effective.value ?? { widthCm: 14.8, heightCm: 21 }
    props.styleDefaults.pageSize = { widthCm: base.widthCm, heightCm: base.heightCm }
  }
  props.styleDefaults.pageSize[key] = cm
}

// Éditer une marge matérialise la surcharge (copie des marges effectives) si elle
// n'existait pas — sinon on partirait d'un objet vide.
function setMargin(key, raw) {
  const cm = fromUnit(raw)
  if (cm == null || cm < 0) return
  if (!props.styleDefaults.pageMargins) {
    props.styleDefaults.pageMargins = { ...effectiveMargins(props.page, null) }
  }
  props.styleDefaults.pageMargins[key] = cm
}
</script>

<style scoped>
.mfc {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.mfc-group {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-end;
}

.mfc-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mfc-field--grow {
  flex: 1 1 auto;
  min-width: 0;
}

.mfc-field--unit {
  flex: 0 0 auto;
}

.mfc-field :deep(.base-select) {
  width: 100%;
}

.mfc-label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink2);
}

.mfc-dims,
.mfc-margins {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2);
}

.mfc-num {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mfc-num-label {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  white-space: nowrap;
}

.mfc-input {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  padding: 0 0.5em;
}

.mfc-input input {
  width: 100%;
  min-width: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
  padding: 0.3em 0;
  text-align: center;
}

.mfc-input input:focus {
  outline: none;
}

.mfc-unit {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}
</style>
