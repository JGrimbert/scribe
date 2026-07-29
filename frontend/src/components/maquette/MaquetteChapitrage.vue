<template>
  <!-- Panneau main d'une source chapitrage : l'aperçu témoin (le premier nœud du
       modèle actif) surmonté du « modèle exigé », puis les modèles relevés. La
       table des styles vit dans l'aside (cf. MaquetteView) — changer un rôle y
       recompose les modèles ici dans le même tick (état partagé du composable). -->
  <div class="maq-chap">
    <FolioView
        :data="data"
        :node-id="witnessNodeId"
        :depth="section.depthKey"
        :visuals="visuals"
        :page="page"
        :margins="margins"
        :hyphenation="hyphenation"
        :running-titles="runningTitles"
        :book-title="bookTitle"
    />

    <div class="models">
      <div class="required-model">
        <span class="required-label">Modèle exigé</span>
        <code class="required-sig">{{ requiredModelLabel }}</code>
      </div>

      <UiNote v-if="shapesError" variant="error">{{ shapesError }}</UiNote>
      <template v-else-if="activeSignature">
        <div class="models-head">
          <span class="models-label">Modèles relevés</span>
          <span class="models-meta">{{ shapeGroup.total - shapeGroup.empty }}/{{ shapeGroup.total }} rédigés</span>
        </div>
        <ul class="model-list">
          <li v-for="signature in shapeGroup.signatures" :key="signature.key">
            <button
                type="button"
                class="model"
                :class="{ 'model--active': signature.key === activeSignature.key }"
                :title="signature.nodes.map((n) => n.titre).join(', ')"
                @click="selectedKey = signature.key"
            >
              <code class="model-sig">{{ signature.label }}</code>
              <span class="model-pct">{{ signature.pct }} %</span>
            </button>
          </li>
        </ul>
      </template>
      <p v-else class="models-empty">Aucun modèle relevé à ce niveau.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import FolioView from '../editor/FolioView.vue'
import UiNote from '../ui/molecules/UiNote.vue'

const props = defineProps({
  // Section de chapitrage courante (zone, styles, shapeGroup, depthKey).
  section: { type: Object, required: true },
  shapesError: { type: String, default: null },
  data: { type: Object, default: null },
  visuals: { type: Object, default: null },
  page: { type: Object, default: null },
  margins: { type: Object, default: null },
  hyphenation: { type: Object, default: null },
  runningTitles: { type: Object, default: null },
  bookTitle: { type: String, default: '' },
})

const shapeGroup = computed(() => props.section.shapeGroup)

// Modèle sélectionné (pilote l'aperçu). `null` → repli sur le premier (le témoin).
// shapeGroup est recalculé à CHAQUE édition de rôle (nouvel objet) : on ne
// réinitialise donc que si la signature choisie a réellement disparu.
const selectedKey = ref(null)
watch(shapeGroup, (group) => {
  const keys = new Set((group?.signatures ?? []).map((s) => s.key))
  if (selectedKey.value && !keys.has(selectedKey.value)) selectedKey.value = null
})

const activeSignature = computed(() => {
  const sigs = shapeGroup.value?.signatures ?? []
  return sigs.find((s) => s.key === selectedKey.value) ?? sigs[0] ?? null
})

const witnessNodeId = computed(() => activeSignature.value?.nodes?.[0]?.nodeId ?? null)

const REQUIRED_MODEL_ORDER = ['chapeau', 'définition', 'citation', 'renvoi']

// Le modèle exigé : titre · <rôles requis, ordre typographique> · corps
// (· tableau). Bâti sur le jeu effectif du niveau (sinon le défaut).
const requiredModelLabel = computed(() => {
  const set = props.section.ruleSet ?? props.section.defaultRuleSet
  const required = REQUIRED_MODEL_ORDER.filter((r) => set.requiresRoles.includes(r))
  const tokens = ['titre', ...required, 'corps']
  if (set.requiresTable) tokens.push('tableau')
  return tokens.join(' · ')
})
</script>

<style scoped>
.maq-chap {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.required-model {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-2);
  margin-bottom: var(--sp-3);
}

.required-label {
  font-size: var(--fs-sm);
  font-weight: 600;
}

.required-sig {
  font-family: var(--font-ui);
  font-size: var(--fs-sm);
  padding: 0.15em 0.55em;
  border: 1px solid var(--c-accent);
  border-radius: var(--radius-md);
  background: var(--c-accent-soft, var(--c-surface));
}

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

.model-sig {
  font-family: var(--font-ui);
}

.model-pct {
  font-variant-numeric: tabular-nums;
  opacity: var(--op-muted);
}
</style>
