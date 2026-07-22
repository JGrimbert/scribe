<template>
  <section class="typo-section">
    <header class="typo-header">
      <h3 class="typo-title">
        <span class="zone-swatch" :style="{ background: zone.color }"></span>
        {{ zone.label }}
      </h3>
      <!-- Point d'injection contextuel, si une zone a de quoi le nourrir. -->
      <slot name="lead" />
    </header>

    <!-- Niveau de chapitrage : trois colonnes en plein écran —
         1) aperçu d'une page (témoin du modèle sélectionné) + liste des modèles,
         2) table des styles,
         3) règles d'éligibilité. -->
    <template v-if="depthKey !== null">
      <div class="typo-cols">
        <!-- Col 1 : aperçu + modèles ------------------------------------------ -->
        <div class="col col--preview">
          <!-- PERF à surveiller : une iframe pagedjs (~900 Ko UMD) par section,
               jusqu'à 3 sur cet écran. Pistes (mutualiser un pagedjs, paginer à la
               demande) documentées en mémoire si le chargement devient lourd. -->
          <FolioView :data="data" :node-id="witnessNodeId" :depth="depthKey" />

          <div class="models">
            <UiNote v-if="shapesError" variant="error">{{ shapesError }}</UiNote>
            <template v-else-if="activeSignature">
              <div class="models-head">
                <span class="models-label">Modèles</span>
                <span class="models-meta">{{ shapeGroup.total - shapeGroup.empty }}/{{ shapeGroup.total }} rédigés</span>
              </div>
              <!-- Le corps ne porte jamais son ×N (cf. script/shapes.js). Chaque
                   signature pilote l'aperçu ; le 1er est le témoin par défaut. -->
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

        <!-- Col 2 : la table des styles --------------------------------------- -->
        <div class="col col--table">
          <StyleRolesTable :styles="styles" :style-roles="styleRoles" />
        </div>

        <!-- Col 3 : les règles d'éligibilité ---------------------------------- -->
        <div class="col col--rules">
          <h4 class="rules-title">Règles d'éligibilité</h4>
          <label class="rule-override">
            <input type="checkbox" :checked="!!ruleSet" @change="$emit('toggle-rules', depthKey)" />
            <span>Des règles propres à ce niveau</span>
          </label>
          <!-- Quand le niveau suit le défaut, valeurs du défaut en grisé. -->
          <RuleSetForm :rule-set="ruleSet ?? defaultRuleSet" :disabled="!ruleSet" />
          <p v-if="!ruleSet" class="rules-scope">
            Ce niveau suit les règles par défaut. Cocher part d'une copie du défaut.
          </p>
        </div>
      </div>
    </template>

    <!-- Liminaire, partie finale : pas de nœuds/modèles/règles. Par défaut les
         styles seuls ; le liminaire injecte son composer de pages via #body
         (le parent le fournit, il a besoin de `trame.liminaire`). -->
    <template v-else>
      <slot name="body">
        <StyleRolesTable :styles="styles" :style-roles="styleRoles" />
      </slot>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import FolioView from '../FolioView.vue'
import RuleSetForm from './RuleSetForm.vue'
import StyleRolesTable from './StyleRolesTable.vue'
import UiNote from '../ui/UiNote.vue'

const props = defineProps({
  zone: { type: Object, required: true },
  styles: { type: Array, required: true },
  // Groupe de modèles de la zone (nul hors chapitrage).
  shapeGroup: { type: Object, default: null },
  shapesError: { type: String, default: null },
  // Profondeur des règles (0/1/2) ; null pour liminaire / final.
  depthKey: { type: Number, default: null },
  // Map réactive styleName → rôle, mutée en place par la table.
  styleRoles: { type: Object, required: true },
  // Jeu de règles propre à ce niveau (byDepth[depthKey]), ou null s'il suit le
  // défaut.
  ruleSet: { type: Object, default: null },
  // Le jeu par défaut, montré grisé quand le niveau n'a pas de règles propres.
  defaultRuleSet: { type: Object, required: true },
  // Le contenu du document (keyé par nodeId) : l'aperçu rend le nœud témoin.
  data: { type: Object, default: null },
})

defineEmits(['toggle-rules'])

// Modèle sélectionné (pilote l'aperçu). `null` → repli sur le premier, le témoin
// par défaut. `shapeGroup` est recalculé à CHAQUE édition de rôle (nouvel objet) :
// on ne réinitialise donc la sélection que si la signature choisie a réellement
// disparu, sans quoi le moindre changement de dropdown ramènerait l'aperçu au
// premier modèle.
const selectedKey = ref(null)
watch(() => props.shapeGroup, (group) => {
  const keys = new Set((group?.signatures ?? []).map((s) => s.key))
  if (selectedKey.value && !keys.has(selectedKey.value)) selectedKey.value = null
})

const activeSignature = computed(() => {
  const sigs = props.shapeGroup?.signatures ?? []
  return sigs.find((s) => s.key === selectedKey.value) ?? sigs[0] ?? null
})

// Le témoin : le premier nœud concerné par le modèle actif.
const witnessNodeId = computed(() => activeSignature.value?.nodes?.[0]?.nodeId ?? null)
</script>

<style scoped>
.typo-section {
  margin-top: var(--sp-6);
}

.typo-header {
  margin-bottom: var(--sp-3);
}

.typo-title {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin: 0;
  font-size: var(--fs-h3);
  font-weight: 600;
}

.zone-swatch {
  width: 0.6em;
  height: 0.6em;
  border-radius: var(--radius-sm);
  align-self: center;
  flex-shrink: 0;
}

/* Trois colonnes en plein écran ; `minmax(0, 1fr)` sur la table pour qu'elle
   puisse rétrécir (sinon son contenu la fait déborder). */
.typo-cols {
  display: grid;
  grid-template-columns: minmax(15em, 20em) minmax(0, 1fr) minmax(16em, 22em);
  gap: var(--sp-5);
  align-items: start;
}

/* En deçà, la grille ne tient plus : on empile. */
@media (max-width: 75em) {
  .typo-cols {
    grid-template-columns: 1fr;
  }
}

.col {
  min-width: 0;
}

/* ── Col 1 : aperçu + modèles ─────────────────────────────────────────────── */
.models {
  margin-top: var(--sp-3);
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

/* Une signature cliquable : elle sélectionne le témoin affiché dans l'aperçu. */
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

/* ── Col 3 : règles ───────────────────────────────────────────────────────── */
.col--rules {
  padding: var(--sp-4);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
}

.rules-title {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-md);
  font-weight: 600;
}

.rule-override {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-md);
  font-weight: 500;
  cursor: pointer;
}

.rules-scope {
  margin: var(--sp-3) 0 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}
</style>
