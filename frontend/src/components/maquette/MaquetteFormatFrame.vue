<template>
  <!-- Cadre de format : l'aperçu au centre, les 4 marges posées sur ses bords
       (tête/pied/petit fond/grand fond), les dimensions au-dessus. Les inputs
       ENTOURENT l'aperçu, chacun près du bord qu'il règle. `styleDefaults` est
       muté en place (comme dans la config). -->
  <div class="mff">
    <!-- Dimensions + unité, au-dessus du cadre. -->
    <div class="mff-dims">
      <label class="mff-dims-field mff-dims-field--grow">
        <span class="mff-label">Dimensions</span>
        <BaseSelect v-model="selectedKey">
          <option value="">Original (.odt)</option>
          <option v-for="f in PAGE_FORMATS" :key="f.key" :value="f.key">{{ f.label }}</option>
          <option value="custom">Personnaliser…</option>
        </BaseSelect>
      </label>
      <label class="mff-dims-field">
        <span class="mff-label">Unité</span>
        <BaseSelect v-model="unit">
          <option v-for="un in UNITS" :key="un.key" :value="un.key">{{ un.label }}</option>
        </BaseSelect>
      </label>
    </div>

    <div v-if="isCustom" class="mff-custom">
      <label class="mff-field">
        <span class="mff-field-label">Largeur</span>
        <span class="mff-input">
          <input type="number" min="0" :step="step" inputmode="decimal"
                 :value="toUnit(effective && effective.widthCm)"
                 @input="setDimension('widthCm', $event.target.value)" />
          <span class="mff-unit">{{ unit }}</span>
        </span>
      </label>
      <label class="mff-field">
        <span class="mff-field-label">Hauteur</span>
        <span class="mff-input">
          <input type="number" min="0" :step="step" inputmode="decimal"
                 :value="toUnit(effective && effective.heightCm)"
                 @input="setDimension('heightCm', $event.target.value)" />
          <span class="mff-unit">{{ unit }}</span>
        </span>
      </label>
    </div>

    <!-- Le cadre : marge de tête (haut), petit/grand fond (côtés), pied (bas),
         l'aperçu au centre. -->
    <div class="mff-frame">
      <div
          v-for="m in MARGINS"
          :key="m.key"
          class="mff-margin"
          :style="{ gridArea: m.area }"
      >
        <span class="mff-field-label">{{ m.label }}</span>
        <span class="mff-input">
          <input type="number" min="0" :step="step" inputmode="decimal"
                 :value="toUnit(marginsView[m.key])"
                 @input="setMargin(m.key, $event.target.value)" />
          <span class="mff-unit">{{ unit }}</span>
        </span>
      </div>

      <div class="mff-preview">
        <PageDiagram :page-size="effective" :margins="marginsView" :running-titles="styleDefaults.runningTitles" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import PageDiagram from '../config/PageDiagram.vue'
import { PAGE_FORMATS, effectiveMargins, effectivePage, matchFormat } from '../../script/pageFormats'

const props = defineProps({
  // PageFormat du .odt (cf. backend/odt-parser).
  page: { type: Object, default: null },
  // Muté en place (pageSize, pageMargins, runningTitles), détenu par le parent.
  styleDefaults: { type: Object, required: true },
})

// Chaque marge sur son bord de l'aperçu — « petit fond » = intérieur (reliure),
// « grand fond » = extérieur.
const MARGINS = [
  { key: 'topCm', label: 'Blanc de tête', area: 'tete' },
  { key: 'innerCm', label: 'Petit fond', area: 'pf' },
  { key: 'outerCm', label: 'Grand fond', area: 'gf' },
  { key: 'bottomCm', label: 'Blanc de pied', area: 'pied' },
]

// Unité d'affichage : le modèle reste en cm, converti à la volée. Partagée entre
// dimensions et marges.
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
.mff {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  align-items: center;
}

.mff-dims {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-end;
  width: 100%;
  max-width: 30em;
}

.mff-dims-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mff-dims-field--grow {
  flex: 1 1 auto;
  min-width: 0;
}

.mff-dims-field :deep(.base-select) {
  width: 100%;
}

.mff-custom {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2);
  width: 100%;
  max-width: 30em;
}

.mff-label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink2);
}

/* Le cadre : 3 colonnes (fond · aperçu · fond) × 3 rangées (tête · aperçu · pied),
   chaque marge dans son aire, centrée sur son bord. */
.mff-frame {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: auto auto auto;
  grid-template-areas:
    ".   tete .  "
    "pf  prev gf "
    ".   pied .  ";
  align-items: center;
  justify-items: center;
  column-gap: var(--sp-3);
  row-gap: var(--sp-2);
}

.mff-preview {
  grid-area: prev;
  width: min(100%, 22em);
}

.mff-preview :deep(.diagram) {
  margin: 0;
  width: 100%;
}

.mff-margin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.mff-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mff-field-label {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  white-space: nowrap;
}

.mff-input {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  padding: 0 0.5em;
}

.mff-input input {
  width: 3.4em;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
  padding: 0.3em 0;
  text-align: center;
}

.mff-input input:focus {
  outline: none;
}

.mff-unit {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}
</style>
