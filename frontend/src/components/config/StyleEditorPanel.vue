<template>
  <!-- Drawer d'édition d'un style : verre dépoli translucide, coulisse depuis la
       droite, DÉMARRE pile sous le doc-bar (top mesuré à l'ouverture — la barre
       est alors rendue, contrairement au montage de DocumentLayout). On n'écrit
       qu'une surcharge Scribe par-dessus le .odt immuable. -->
  <Transition name="drawer">
    <aside
        v-if="styleName"
        class="style-panel"
        :style="{ top: topPx }"
        role="dialog"
        aria-label="Édition du style"
    >
      <header class="sp-head">
        <div class="sp-title">
          <span class="sp-kicker">Style</span>
          <span class="sp-name">{{ styleName }}</span>
        </div>
        <button class="sp-close" title="Fermer (Échap)" @click="$emit('close')">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </header>

      <div class="sp-scroll">
        <section class="sp-group">
          <h4 class="sp-group-title">Typographie</h4>

          <div class="sp-row">
            <span class="sp-label">Police</span>
            <select class="sp-select" :value="current?.fontFamily ?? ''" @change="setField('fontFamily', $event.target.value)">
              <option value="">défaut{{ base?.fontFamily ? ` · ${short(base.fontFamily)}` : '' }}</option>
              <option v-for="f in fonts" :key="f" :value="f" :style="{ fontFamily: f }">{{ short(f) }}</option>
            </select>
          </div>

          <div class="sp-row">
            <span class="sp-label">Corps</span>
            <div class="sp-textctl">
              <input
                  class="sp-input"
                  type="text"
                  :value="current?.fontSize ?? ''"
                  :placeholder="base?.fontSize || 'ex. 12pt'"
                  @input="setField('fontSize', $event.target.value)"
              />
              <button v-if="current?.fontSize" class="sp-clear" title="Rétablir le .odt" @click="setField('fontSize', '')">
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <div class="sp-row">
            <span class="sp-label">Interligne</span>
            <div class="sp-textctl">
              <input
                  class="sp-input"
                  type="text"
                  :value="current?.lineHeight ?? ''"
                  :placeholder="base?.lineHeight || 'ex. 1.4'"
                  @input="setField('lineHeight', $event.target.value)"
              />
              <button v-if="current?.lineHeight" class="sp-clear" title="Rétablir le .odt" @click="setField('lineHeight', '')">
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <div class="sp-row">
            <span class="sp-label">Alignement</span>
            <div class="sp-ctl">
              <label class="sp-def" title="Suivre le .odt">
                <input type="checkbox" :checked="alignIsDefault" @change="setAlignDefault($event.target.checked)" />
                défaut
              </label>
              <div class="sp-seg" :class="{ 'sp-seg--muted': alignIsDefault }">
                <button
                    v-for="a in ALIGN"
                    :key="a.value"
                    class="sp-seg-btn"
                    :class="{ 'sp-seg-btn--on': alignEffective === a.value }"
                    :title="a.label"
                    @click="setField('align', a.value)"
                >
                  <i :class="a.icon" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </div>

          <div v-for="f in EMPHASIS" :key="f.key" class="sp-row">
            <span class="sp-label">{{ f.label }}</span>
            <div class="sp-ctl">
              <label class="sp-def" title="Suivre le .odt">
                <input type="checkbox" :checked="isDefault(f.key)" @change="setBoolDefault(f.key, $event.target.checked)" />
                défaut
              </label>
              <BaseToggle
                  :model-value="boolDisplay(f.key)"
                  :muted="isDefault(f.key)"
                  @update:model-value="setField(f.key, $event)"
              />
            </div>
          </div>

          <div class="sp-row">
            <span class="sp-label">Couleur</span>
            <div class="sp-ctl">
              <label class="sp-def" title="Suivre le .odt">
                <input type="checkbox" :checked="colorIsDefault" @change="setColorDefault($event.target.checked)" />
                défaut
              </label>
              <input
                  class="sp-color"
                  :class="{ 'sp-color--muted': colorIsDefault }"
                  type="color"
                  :value="colorValue"
                  @input="setField('color', $event.target.value)"
              />
            </div>
          </div>

          <div class="sp-row">
            <span class="sp-label">Petites capitales</span>
            <div class="sp-ctl">
              <label class="sp-def" title="Suivre le .odt">
                <input type="checkbox" :checked="scIsDefault" @change="setScDefault($event.target.checked)" />
                défaut
              </label>
              <BaseToggle
                  :model-value="scDisplay"
                  :muted="scIsDefault"
                  @update:model-value="setField('fontVariant', $event ? 'small-caps' : 'normal')"
              />
            </div>
          </div>

          <div class="sp-row">
            <span class="sp-label">Interlettrage</span>
            <div class="sp-textctl">
              <input
                  class="sp-input"
                  type="text"
                  :value="current?.letterSpacing ?? ''"
                  :placeholder="base?.letterSpacing || 'ex. 0.02cm'"
                  @input="setField('letterSpacing', $event.target.value)"
              />
              <button v-if="current?.letterSpacing" class="sp-clear" title="Rétablir le .odt" @click="setField('letterSpacing', '')">
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </section>

        <section class="sp-group">
          <h4 class="sp-group-title">Paragraphe</h4>
          <div v-for="m in METRIC_FIELDS" :key="m.key" class="sp-row">
            <span class="sp-label">{{ m.label }}</span>
            <div class="sp-textctl">
              <input
                  class="sp-input"
                  type="text"
                  :value="current?.[m.key] ?? ''"
                  :placeholder="base?.[m.key] || m.ph"
                  @input="setField(m.key, $event.target.value)"
              />
              <button v-if="current?.[m.key]" class="sp-clear" title="Rétablir le .odt" @click="setField(m.key, '')">
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </section>

        <section class="sp-group">
          <h4 class="sp-group-title">Composition</h4>
          <div class="sp-row">
            <span class="sp-label">Césure</span>
            <div class="sp-ctl">
              <label class="sp-def" title="Suivre le .odt / le défaut global">
                <input type="checkbox" :checked="isDefault('hyphenate')" @change="setBoolDefault('hyphenate', $event.target.checked)" />
                défaut
              </label>
              <BaseToggle
                  :model-value="boolDisplay('hyphenate')"
                  :muted="isDefault('hyphenate')"
                  @update:model-value="setField('hyphenate', $event)"
              />
            </div>
          </div>

          <div class="sp-row">
            <span class="sp-label" title="Empêche une coupure de page après ce style (un titre ne reste pas seul en bas de page)">Garder avec le suivant</span>
            <div class="sp-ctl">
              <label class="sp-def" title="Suivre le .odt">
                <input type="checkbox" :checked="isDefault('keepWithNext')" @change="setBoolDefault('keepWithNext', $event.target.checked)" />
                défaut
              </label>
              <BaseToggle
                  :model-value="boolDisplay('keepWithNext')"
                  :muted="isDefault('keepWithNext')"
                  @update:model-value="setField('keepWithNext', $event)"
              />
            </div>
          </div>

          <div v-for="m in FLOW_NUM_FIELDS" :key="m.key" class="sp-row">
            <span class="sp-label" :title="m.hint">{{ m.label }}</span>
            <div class="sp-textctl">
              <input
                  class="sp-input sp-input--num"
                  type="number"
                  min="1"
                  :value="current?.[m.key] ?? ''"
                  :placeholder="base?.[m.key] != null ? String(base[m.key]) : m.ph"
                  @input="setNumber(m.key, $event.target.value)"
              />
              <button v-if="current?.[m.key] != null" class="sp-clear" title="Rétablir le .odt" @click="setField(m.key, '')">
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </section>
      </div>

      <footer class="sp-foot">
        <BaseButton variant="ghost" icon="pi-replay" :disabled="!hasOverride" @click="resetAll">
          Revenir au <code>.odt</code>
        </BaseButton>
      </footer>
    </aside>
  </Transition>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import BaseButton from '../ui/atoms/BaseButton.vue'
import BaseToggle from '../ui/atoms/BaseToggle.vue'

// `overrides` = map réactive { [style]: Partial<StyleVisual> } détenue par le
// composable de config, mutée EN PLACE. `base` = valeurs .odt (lecture seule).
const props = defineProps({
  styleName: { type: String, default: null },
  base: { type: Object, default: null },
  overrides: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const EMPHASIS = [
  { key: 'bold', label: 'Gras' },
  { key: 'italic', label: 'Italique' },
]
const ALIGN = [
  { value: 'left', label: 'À gauche', icon: 'pi pi-align-left' },
  { value: 'center', label: 'Centré', icon: 'pi pi-align-center' },
  { value: 'right', label: 'À droite', icon: 'pi pi-align-right' },
  { value: 'justify', label: 'Justifié', icon: 'pi pi-align-justify' },
]
// Métriques de paragraphe : champs texte libres (unités CSS/ODT : cm, pt, %…).
const METRIC_FIELDS = [
  { key: 'marginTop', label: 'Espace avant', ph: 'ex. 0.4cm' },
  { key: 'marginBottom', label: 'Espace après', ph: 'ex. 0.2cm' },
  { key: 'textIndent', label: 'Retrait 1ʳᵉ ligne', ph: 'ex. 1cm' },
  { key: 'marginLeft', label: 'Retrait gauche', ph: 'ex. 0.5cm' },
  { key: 'marginRight', label: 'Retrait droite', ph: 'ex. 0.5cm' },
]
// Flux : nombres de lignes (entiers). orphans = min en bas de page avant coupure,
// widows = min en haut de la page suivante.
const FLOW_NUM_FIELDS = [
  { key: 'orphans', label: 'Orphelines', ph: 'ex. 2', hint: 'Lignes minimales conservées en bas de page avant une coupure' },
  { key: 'widows', label: 'Veuves', ph: 'ex. 2', hint: 'Lignes minimales reportées en haut de la page suivante' },
]

const FONT_LIBRARY = [
  'Georgia, serif',
  'Garamond, serif',
  '"Times New Roman", serif',
  'Cambria, serif',
  '"Book Antiqua", Palatino, serif',
  '"Playfair Display", serif',
  'Calibri, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Verdana, sans-serif',
  '"Courier New", monospace',
]
const fonts = computed(() => {
  const b = props.base?.fontFamily
  const list = [...FONT_LIBRARY]
  if (b && !list.includes(b)) list.unshift(b)
  return list
})

const current = computed(() => props.overrides[props.styleName] ?? null)
const hasOverride = computed(() => current.value != null)

function short(family) {
  return String(family).split(',')[0].replace(/["']/g, '').trim()
}

// ── Positionnement : bas du doc-bar, mesuré À L'OUVERTURE (la barre est rendue) ──
const topPx = ref(null)
function measureTop() {
  const bar = document.querySelector('.document-layout__bar')
  topPx.value = bar ? `${Math.round(bar.getBoundingClientRect().bottom)}px` : null
}
watch(() => props.styleName, (name) => { if (name) nextTick(measureTop) })

// ── Booléens (gras/italique/césure) ─────────────────────────────────────────
function isDefault(key) {
  return current.value?.[key] === undefined
}
function boolDisplay(key) {
  return current.value?.[key] ?? props.base?.[key] ?? false
}
function setBoolDefault(key, checked) {
  setField(key, checked ? undefined : (props.base?.[key] ?? false))
}

// ── Couleur ──────────────────────────────────────────────────────────────────
const colorIsDefault = computed(() => current.value?.color === undefined)
// input type=color exige un #rrggbb : repli noir si ni surcharge ni .odt.
const colorValue = computed(() => current.value?.color ?? props.base?.color ?? '#000000')
function setColorDefault(checked) {
  setField('color', checked ? undefined : (props.base?.color ?? '#000000'))
}

// ── Petites capitales (fontVariant, valeur chaîne small-caps/normal) ─────────
const scIsDefault = computed(() => current.value?.fontVariant === undefined)
const scDisplay = computed(() => (current.value?.fontVariant ?? props.base?.fontVariant) === 'small-caps')
function setScDefault(checked) {
  setField('fontVariant', checked ? undefined : (props.base?.fontVariant ?? 'normal'))
}

// ── Alignement ─────────────────────────────────────────────────────────────
function normAlign(v) {
  if (v === 'start') return 'left'
  if (v === 'end') return 'right'
  return v ?? null
}
const alignIsDefault = computed(() => current.value?.align === undefined)
const alignEffective = computed(() => normAlign(current.value?.align ?? props.base?.align))
function setAlignDefault(checked) {
  setField('align', checked ? undefined : (normAlign(props.base?.align) ?? 'left'))
}

// ── Écriture d'une surcharge ────────────────────────────────────────────────
function setField(key, value) {
  const map = props.overrides
  const name = props.styleName
  if (value === undefined || value === '') {
    if (map[name]) {
      delete map[name][key]
      if (!Object.keys(map[name]).length) delete map[name]
    }
    return
  }
  if (!map[name]) map[name] = {}
  map[name][key] = value
}
// Métrique numérique (veuves/orphelines) : parse en entier ; vide/NaN = efface.
function setNumber(key, raw) {
  if (raw === '' || raw == null) return setField(key, '')
  const n = parseInt(raw, 10)
  setField(key, Number.isNaN(n) ? '' : n)
}

function resetAll() {
  delete props.overrides[props.styleName]
}

function onKey(e) {
  if (e.key === 'Escape' && props.styleName) emit('close')
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', measureTop)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', measureTop)
})
</script>

<style scoped>
.style-panel {
  position: fixed;
  /* Repli si la mesure n'a pas encore eu lieu ; l'inline `top` (bas réel du
     doc-bar) prend le dessus dès l'ouverture. */
  top: calc(var(--bar-size) * 2);
  right: 0;
  bottom: 0;
  width: min(320px, 90vw);
  z-index: 40;
  display: flex;
  flex-direction: column;
  /* Verre dépoli : translucide + flou de l'arrière-plan, filet discret. */
  background: color-mix(in srgb, var(--c-paper) 66%, transparent);
  backdrop-filter: blur(18px) saturate(1.15);
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
  border-left: 1px solid color-mix(in srgb, var(--c-border) 60%, transparent);
  box-shadow: -8px 0 28px rgba(0, 0, 0, 0.10);
}

.sp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-4) var(--sp-2);
}

.sp-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sp-kicker {
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--c-ink2);
}

.sp-name {
  font-weight: 600;
  font-size: var(--fs-md);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-close {
  flex: 0 0 auto;
  border: none;
  background: transparent;
  color: var(--c-ink2);
  cursor: pointer;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}
.sp-close:hover {
  color: var(--c-ink);
  background: color-mix(in srgb, var(--c-ink) 8%, transparent);
}

.sp-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-2) var(--sp-4) var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.sp-group {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.sp-group-title {
  margin: 0;
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--c-ink2);
  opacity: var(--op-muted, 0.6);
}

.sp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  min-height: 1.8rem;
}

.sp-label {
  font-size: var(--fs-sm);
  font-weight: 500;
}

.sp-ctl {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.sp-def {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  cursor: pointer;
  user-select: none;
}

.sp-input,
.sp-select {
  width: 11rem;
  max-width: 60%;
  padding: 0.3em 0.5em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
}
.sp-select {
  cursor: pointer;
}
.sp-input--num {
  width: 4.5rem;
}

/* Pastille de couleur : petit carré cliquable, grisé quand on suit le .odt. */
.sp-color {
  width: 2rem;
  height: 1.5rem;
  padding: 0;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
}
.sp-color--muted {
  opacity: var(--op-muted, 0.45);
}

/* Champ texte + son reset ✕ (rétablit la valeur .odt), aligné à droite. */
.sp-textctl {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}
.sp-clear {
  border: none;
  background: transparent;
  color: var(--c-ink2);
  cursor: pointer;
  padding: 2px;
  font-size: var(--fs-xs);
  border-radius: var(--radius-sm);
}
.sp-clear:hover {
  color: var(--c-ink);
}

.sp-seg {
  display: inline-flex;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--c-surface);
}
.sp-seg--muted {
  opacity: var(--op-muted, 0.45);
}
.sp-seg-btn {
  border: none;
  background: transparent;
  color: var(--c-ink2);
  cursor: pointer;
  padding: 0.28em 0.5em;
  font-size: var(--fs-sm);
  border-left: 1px solid var(--c-border);
}
.sp-seg-btn:first-child {
  border-left: none;
}
.sp-seg-btn:hover {
  color: var(--c-ink);
  background: color-mix(in srgb, var(--c-ink) 6%, transparent);
}
.sp-seg-btn--on,
.sp-seg-btn--on:hover {
  background: var(--c-accent-alt);
  color: #fff;
}

.sp-foot {
  flex: 0 0 auto;
  padding: var(--sp-3) var(--sp-4);
  border-top: 1px solid color-mix(in srgb, var(--c-border) 60%, transparent);
}

/* Entrée/sortie latérale, compositor-only. */
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.24s ease, opacity 0.24s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
