<template>
  <div class="pf">
    <!-- Dimensions + unité -->
    <div class="pf-row">
      <div class="pf-field pf-field--grow">
        <label class="pf-label" for="pf-format">Dimensions</label>
        <BaseSelect id="pf-format" v-model="selectedKey">
          <option value="">{{ originalLabel }}</option>
          <option v-for="f in PAGE_FORMATS" :key="f.key" :value="f.key">{{ f.label }}</option>
          <option value="custom">Personnaliser…</option>
        </BaseSelect>
      </div>
      <div class="pf-field">
        <label class="pf-label" for="pf-unit">Unité</label>
        <BaseSelect id="pf-unit" v-model="unit">
          <option v-for="un in UNITS" :key="un.key" :value="un.key">{{ un.label }}</option>
        </BaseSelect>
      </div>
    </div>

    <!-- Dimensions personnalisées (largeur × hauteur) OU affichage des dimensions -->
    <div v-if="isCustom" class="pf-grid pf-grid--2">
      <label class="pf-num">
        <span class="pf-num-label">Largeur</span>
        <span class="pf-input">
          <input type="number" min="0" :step="step" inputmode="decimal"
                 :value="toUnit(effective && effective.widthCm)"
                 @input="setDimension('widthCm', $event.target.value)" />
          <span class="pf-unit">{{ unit }}</span>
        </span>
      </label>
      <label class="pf-num">
        <span class="pf-num-label">Hauteur</span>
        <span class="pf-input">
          <input type="number" min="0" :step="step" inputmode="decimal"
                 :value="toUnit(effective && effective.heightCm)"
                 @input="setDimension('heightCm', $event.target.value)" />
          <span class="pf-unit">{{ unit }}</span>
        </span>
      </label>
    </div>
    <div v-else-if="effective" class="pf-dims">
      <span class="pf-dim"><i class="pi pi-arrows-h" aria-hidden="true"></i>{{ toUnit(effective.widthCm) }} {{ unit }}</span>
      <span class="pf-dim"><i class="pi pi-arrows-v" aria-hidden="true"></i>{{ toUnit(effective.heightCm) }} {{ unit }}</span>
    </div>

    <!-- Marges (miroir recto/verso) -->
    <div class="pf-margins">
      <div class="pf-margins-head">
        <span class="pf-label">Marges <span class="pf-sub">recto / verso</span></span>
        <button v-if="styleDefaults.pageMargins" type="button" class="link-btn" @click="resetMargins">
          Reprendre du .odt
        </button>
      </div>
      <div class="pf-grid pf-grid--2">
        <label v-for="mgn in MARGIN_FIELDS" :key="mgn.key" class="pf-num">
          <span class="pf-num-label">{{ mgn.label }}</span>
          <span class="pf-input">
            <input type="number" min="0" :step="step" inputmode="decimal"
                   :value="toUnit(marginsView[mgn.key])"
                   @input="setMargin(mgn.key, $event.target.value)" />
            <span class="pf-unit">{{ unit }}</span>
          </span>
        </label>
      </div>
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
  // Muté en place (pageSize, pageMargins) : l'objet réactif est détenu par
  // useTypologyConfig.
  styleDefaults: { type: Object, required: true },
})

// « Petit fond » = intérieur (reliure/gouttière), « grand fond » = extérieur.
const MARGIN_FIELDS = [
  { key: 'topCm', label: 'Blanc de tête' },
  { key: 'bottomCm', label: 'Blanc de pied' },
  { key: 'innerCm', label: 'Petit fond' },
  { key: 'outerCm', label: 'Grand fond' },
]

// Unités d'affichage : le modèle reste en cm, on convertit à la volée. `perCm` =
// nombre d'unités par cm ; `dec` = décimales d'affichage.
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

// Le select stocke des DIMENSIONS (pas un nom de format) : un pageSize enregistré
// reste valable même si la liste évolue. « custom » = pageSize hors formats connus.
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
      // Matérialise depuis les dimensions effectives pour peupler les champs.
      const base = effective.value ?? { widthCm: 14.8, heightCm: 21 }
      props.styleDefaults.pageSize = { widthCm: base.widthCm, heightCm: base.heightCm }
    } else {
      const f = PAGE_FORMATS.find((x) => x.key === key)
      if (f) props.styleDefaults.pageSize = { widthCm: f.widthCm, heightCm: f.heightCm }
    }
  },
})

const isCustom = computed(() => selectedKey.value === 'custom')

const originalLabel = computed(() => {
  if (!props.page) return 'Original (.odt)'
  const name = matchFormat(props.page.widthCm, props.page.heightCm)?.key
  return name
    ? `Original (.odt) — ${name}`
    : `Original (.odt) — ${toUnit(props.page.widthCm)} × ${toUnit(props.page.heightCm)} ${unit.value}`
})

const effective = computed(() => effectivePage(props.page, props.styleDefaults.pageSize))
const marginsView = computed(() => effectiveMargins(props.page, props.styleDefaults.pageMargins))

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

function resetMargins() {
  props.styleDefaults.pageMargins = null
}
</script>

<style scoped>
.pf {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.pf-row {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-end;
}

.pf-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pf-field--grow {
  flex: 1 1 auto;
  min-width: 0;
}

.pf-field :deep(.base-select) {
  width: 100%;
}

.pf-label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink2);
}

.pf-sub {
  font-weight: 400;
  opacity: var(--op-muted);
}

.pf-dims {
  display: flex;
  gap: var(--sp-3);
  font-size: var(--fs-sm);
  color: var(--c-ink2);
  font-variant-numeric: tabular-nums;
}

.pf-dim {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pf-margins-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}

.link-btn {
  border: none;
  background: none;
  padding: 0;
  color: var(--c-accent-alt-darker);
  font: inherit;
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

.pf-grid {
  display: grid;
  gap: var(--sp-2);
}

.pf-grid--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pf-num {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pf-num-label {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}

.pf-input {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  padding: 0 0.5em;
}

.pf-input input {
  width: 100%;
  min-width: 2.5em;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
  padding: 0.3em 0;
}

.pf-input input:focus {
  outline: none;
}

.pf-unit {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}
</style>
