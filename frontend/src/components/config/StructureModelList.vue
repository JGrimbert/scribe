<template>
  <div class="model-list-block">
    <UiNote v-if="shapesError" variant="error">{{ shapesError }}</UiNote>
    <template v-else-if="signatures.length">
      <div class="models-head">
        <span class="models-label">{{ label }}</span>
        <span class="models-meta">{{ shapeGroup.total - shapeGroup.empty }}/{{ shapeGroup.total }} rédigés</span>
      </div>
      <!-- Le corps ne porte jamais son ×N (cf. script/shapes.js). En mode
           interactif, chaque signature pilote l'aperçu ; en lecture seule
           (aside maquette), la liste est purement informative. -->
      <ul class="model-list">
        <li v-for="signature in signatures" :key="signature.key">
          <component
              :is="interactive ? 'button' : 'span'"
              :type="interactive ? 'button' : null"
              class="model"
              :class="{
                'model--active': interactive && signature.key === activeKey,
                'model--static': !interactive,
              }"
              :title="signature.nodes.map((n) => n.titre).join(', ')"
              @click="interactive && $emit('select', signature.key)"
          >
            <code class="model-sig">{{ signature.label }}</code>
            <span class="model-pct">{{ signature.pct }} %</span>
          </component>
        </li>
      </ul>
    </template>
    <p v-else class="models-empty">Aucun modèle relevé à ce niveau.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import UiNote from '../ui/molecules/UiNote.vue'

const props = defineProps({
  // Groupe de modèles relevés de la zone (nul hors chapitrage).
  shapeGroup: { type: Object, default: null },
  shapesError: { type: String, default: null },
  // Signature active (surlignée) en mode interactif.
  activeKey: { type: String, default: null },
  // Interactif : les signatures sont des boutons qui émettent `select`. Lecture
  // seule (aside maquette) : de simples pastilles informatives.
  interactive: { type: Boolean, default: true },
  label: { type: String, default: 'Modèles relevés' },
})

defineEmits(['select'])

const signatures = computed(() => props.shapeGroup?.signatures ?? [])
</script>

<style scoped>
.models-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}

.models-label {
  font-size: var(--fs-sm);
  font-weight: 600;
}

.models-meta {
  font-size: var(--fs-xs);
  opacity: var(--op-faint);
}

.models-empty {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.model-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.model {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4em;
  padding: 0.15em 0.55em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  font: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
  transition: border-color 0.1s ease, background 0.1s ease;
}

.model:hover {
  border-color: var(--c-accent);
}

.model--active {
  border-color: var(--c-accent);
  background: var(--c-accent-soft, var(--c-surface));
  box-shadow: inset 0 0 0 1px var(--c-accent);
}

/* Lecture seule : ni curseur cliquable ni survol accentué. */
.model--static {
  cursor: default;
}

.model--static:hover {
  border-color: var(--c-border);
}

.model-sig {
  font-family: var(--font-ui);
}

.model-pct {
  font-variant-numeric: tabular-nums;
  opacity: var(--op-muted);
}
</style>
