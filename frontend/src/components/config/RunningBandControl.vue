<template>
  <div class="band" :class="{ 'band--on': band.enabled }">
    <label class="band-toggle">
      <input type="checkbox" v-model="band.enabled" />
      <span class="band-name"><i :class="`pi ${icon}`" aria-hidden="true"></i>{{ label }}</span>
    </label>

    <div v-if="band.enabled || alwaysOpen" class="band-body">
      <!-- Entête de corps optionnelle (ex : le « blanc » de marge associé à la
           bande, injecté par l'hôte — écran Maquette). -->
      <slot name="lead" />

      <!-- Symétrique (pied de page) : un seul contenu, identique recto/verso. -->
      <label v-if="symmetric" class="row">
        <span class="row-label">Contenu</span>
        <BaseSelect v-model="content">
          <option v-for="o in CONTENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </BaseSelect>
      </label>
      <div v-else class="band-sides" :class="{ 'band-sides--inline': inlineSides }">
        <label class="row">
          <span class="row-label">Pages impaires <em>recto</em></span>
          <BaseSelect v-model="band.recto">
            <option v-for="o in CONTENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </BaseSelect>
        </label>
        <label class="row">
          <span class="row-label">Pages paires <em>verso</em></span>
          <BaseSelect v-model="band.verso">
            <option v-for="o in CONTENT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </BaseSelect>
        </label>
      </div>
      <label class="row">
        <span class="row-label">Justification</span>
        <BaseSelect v-model="band.justification">
          <option value="centre">Centré</option>
          <option value="regard">En regard (extérieur)</option>
        </BaseSelect>
      </label>
      <label class="row">
        <span class="row-label">Hauteur</span>
        <span class="num">
          <input
              type="number" min="0" step="0.1" inputmode="decimal" placeholder="auto"
              :value="band.heightCm ?? ''"
              @input="setHeight($event.target.value)"
          />
          <span class="unit">cm</span>
        </span>
      </label>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'

const props = defineProps({
  // Bande (en-tête ou pied), mutée EN PLACE :
  // { enabled, recto, verso, heightCm, justification }.
  band: { type: Object, required: true },
  label: { type: String, required: true },
  icon: { type: String, default: 'pi-align-center' },
  // Pied de page : identique recto/verso. Un seul select, qui écrit les deux côtés.
  symmetric: { type: Boolean, default: false },
  // Propose « Numéro de page » (folio) comme contenu (le pied, par convention).
  allowFolio: { type: Boolean, default: false },
  // Corps toujours visible, sans repli sur `enabled` : la case reste une bascule
  // d'activation mais les options ne se cachent plus (écran Maquette, aside).
  alwaysOpen: { type: Boolean, default: false },
  // Recto/verso côte à côte (label au-dessus du select) au lieu d'empilés en
  // pleine largeur — écran Maquette, où la colonne est étroite.
  inlineSides: { type: Boolean, default: false },
})

// En mode symétrique, un contenu unique piloté par recto (verso suit).
const content = computed({
  get: () => props.band.recto,
  set: (v) => { props.band.recto = v; props.band.verso = v },
})

const CONTENT_OPTIONS = computed(() => [
  { value: 'titre', label: 'Titre du livre' },
  { value: 'chapitre', label: 'Nom du chapitre' },
  ...(props.allowFolio ? [{ value: 'folio', label: 'Numéro de page' }] : []),
  { value: 'aucun', label: 'Rien' },
])

function setHeight(raw) {
  const s = String(raw).trim()
  if (s === '') { props.band.heightCm = null; return }
  const n = Number(s)
  props.band.heightCm = Number.isFinite(n) && n > 0 ? n : null
}
</script>

<style scoped>
.band {
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  padding: var(--sp-2) var(--sp-3);
}

.band--on {
  border-color: color-mix(in srgb, var(--c-accent) 45%, var(--c-border));
}

.band-toggle {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  cursor: pointer;
  font-size: var(--fs-sm);
}

.band-name {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-weight: 600;
}

.band-name i {
  color: var(--c-accent-alt-darker);
}

.band-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
  padding-top: var(--sp-2);
  border-top: 1px dashed var(--c-border);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
}

/* Recto/verso : empilés par défaut, côte à côte (label au-dessus) en mode inline. */
.band-sides {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.band-sides--inline {
  flex-direction: row;
  gap: var(--sp-3);
}

.band-sides--inline .row {
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 3px;
}

.band-sides--inline .row :deep(select) {
  width: 100%;
}

.row-label {
  color: var(--c-ink2);
}

.row-label em {
  font-style: normal;
  opacity: var(--op-muted);
  font-size: var(--fs-xs);
}

.num {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-bg, var(--c-surface));
  padding: 0 0.5em;
}

.num input {
  width: 3.4em;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
  padding: 0.3em 0;
}

.num input:focus {
  outline: none;
}

.unit {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}
</style>
