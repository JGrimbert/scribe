<template>
  <section class="config-section">
    <h3 class="section-title">Format de page</h3>
    <p class="section-hint">
      Dimensions et marges reprises du <code>.odt</code> (appliquées au rendu paginé).
      En lecture seule pour l'instant — elles deviendront modifiables.
    </p>

    <p v-if="!page" class="empty">Format de page non relevé pour ce document.</p>

    <div v-else class="pf">
      <!-- Dimensions : le format nommé (A5…) quand on le reconnaît, sinon les
           seules mesures. -->
      <div class="pf-group">
        <span class="pf-group-label">Dimensions<span v-if="formatName" class="pf-format">{{ formatName }}</span></span>
        <dl class="pf-fields">
          <div class="pf-field"><dt>Largeur</dt><dd>{{ mm(page.widthCm) }}</dd></div>
          <div class="pf-field"><dt>Hauteur</dt><dd>{{ mm(page.heightCm) }}</dd></div>
        </dl>
      </div>

      <div class="pf-group">
        <span class="pf-group-label">Marges</span>
        <dl class="pf-fields">
          <div class="pf-field"><dt>Haut</dt><dd>{{ mm(page.marginTopCm) }}</dd></div>
          <div class="pf-field"><dt>Bas</dt><dd>{{ mm(page.marginBottomCm) }}</dd></div>
          <div class="pf-field"><dt>Gauche</dt><dd>{{ mm(page.marginLeftCm) }}</dd></div>
          <div class="pf-field"><dt>Droite</dt><dd>{{ mm(page.marginRightCm) }}</dd></div>
        </dl>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // PageFormat (cf. backend/odt-parser) : { widthCm, heightCm, margin*Cm }.
  page: { type: Object, default: null },
})

// cm → mm, arrondi au dixième, suffixé (unité d'usage en PAO).
function mm(cm) {
  if (cm == null) return '—'
  return `${Math.round(cm * 100) / 10} mm`
}

// Formats normalisés A-series + Letter, reconnus à ±0,3 cm près (le témoin est à
// 14,801 × 21,001 cm, pas pile A5). Purement indicatif.
const STANDARD_FORMATS = [
  { name: 'A6', w: 10.5, h: 14.8 },
  { name: 'A5', w: 14.8, h: 21.0 },
  { name: 'A4', w: 21.0, h: 29.7 },
  { name: 'A3', w: 29.7, h: 42.0 },
  { name: 'Letter', w: 21.59, h: 27.94 },
]

const formatName = computed(() => {
  if (!props.page) return null
  const { widthCm: w, heightCm: h } = props.page
  const near = (a, b) => Math.abs(a - b) <= 0.3
  const match = STANDARD_FORMATS.find((f) => near(w, f.w) && near(h, f.h))
  return match?.name ?? null
})
</script>

<style scoped>
.config-section {
  margin-top: var(--sp-6);
}

.section-title {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-md);
  font-weight: 600;
}

.section-hint {
  margin: 0 0 var(--sp-3);
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.empty {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-md);
}

.pf {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-6);
}

.pf-group {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.pf-group-label {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink2);
}

.pf-format {
  font-weight: 400;
  color: var(--c-accent-alt-darker);
  font-variant-numeric: tabular-nums;
}

.pf-fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: 0;
}

/* Un champ = libellé au-dessus, valeur encadrée : la forme d'un champ de
   formulaire à venir, mais figée (lecture seule). */
.pf-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pf-field dt {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}

.pf-field dd {
  margin: 0;
  padding: 0.25em 0.6em;
  min-width: 5em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
}
</style>
