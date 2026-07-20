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

    <!-- Niveau de chapitrage : styles + modèles inlinés dans le main, règles
         d'éligibilité dans l'aside. Cadre effacé (bare) : c'est l'aside qui
         porte la bordure. -->
    <template v-if="depthKey !== null">
      <AnalyseBlock aside="right" bare>
        <template #main>
          <StyleRolesTable :styles="styles" :style-roles="styleRoles" />

          <!-- Modèles inlinés, discrets : les formes récurrentes en une ligne,
               pas une card à part. Le corps ne porte pas son ×N (cf.
               script/shapes.js). -->
          <div class="models">
            <UiNote v-if="shapesError" variant="error">{{ shapesError }}</UiNote>
            <template v-else-if="shapeGroup && shapeGroup.signatures.length">
              <span class="models-label">Modèles</span>
              <span class="models-meta">{{ shapeGroup.total - shapeGroup.empty }}/{{ shapeGroup.total }} rédigés</span>
              <ul class="model-list">
                <li
                    v-for="signature in shapeGroup.signatures.slice(0, 8)"
                    :key="signature.key"
                    class="model"
                    :title="signature.nodes.map((n) => n.titre).join(', ')"
                >
                  <code class="model-sig">{{ signature.label }}</code>
                  <span class="model-pct">{{ signature.pct }} %</span>
                </li>
              </ul>
            </template>
          </div>
        </template>

        <template #aside>
          <div class="rules-aside">
            <h4 class="rules-title">Règles d'éligibilité</h4>
            <label class="rule-override">
              <input type="checkbox" :checked="!!ruleSet" @change="$emit('toggle-rules', depthKey)" />
              <span>Des règles propres à ce niveau</span>
            </label>
            <!-- Toujours affichées : quand le niveau suit le défaut, on montre
                 les valeurs du défaut en grisé plutôt qu'un vide. -->
            <RuleSetForm :rule-set="ruleSet ?? defaultRuleSet" :disabled="!ruleSet" />
            <p v-if="!ruleSet" class="rules-scope">
              Ce niveau suit les règles par défaut. Cocher part d'une copie du défaut.
            </p>
          </div>
        </template>
      </AnalyseBlock>
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
import AnalyseBlock from './analyse/AnalyseBlock.vue'
import RuleSetForm from './RuleSetForm.vue'
import StyleRolesTable from './StyleRolesTable.vue'
import UiNote from './ui/UiNote.vue'

defineProps({
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
})

defineEmits(['toggle-rules'])
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
  font-size: var(--fs-md);
  font-weight: 600;
}

.zone-swatch {
  width: 0.6em;
  height: 0.6em;
  border-radius: var(--radius-sm);
  align-self: center;
  flex-shrink: 0;
}

/* Modèles inlinés sous la table : une ligne de signatures, discrète. */
.models {
  margin-top: var(--sp-4);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-2) var(--sp-3);
}

.models-label {
  font-size: var(--fs-sm);
  font-weight: 600;
}

.models-meta {
  font-size: var(--fs-xs);
  opacity: var(--op-faint);
}

.model-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  flex: 1 1 100%;
}

.model {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4em;
  font-size: var(--fs-sm);
}

.model-sig {
  font-family: var(--font-ui);
  padding: 0.1em 0.5em;
  border-radius: var(--radius-md);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}

.model-pct {
  font-variant-numeric: tabular-nums;
  opacity: var(--op-muted);
}

/* L'aside porte sa propre bordure (mode bare) : elle a besoin de sa
   respiration. */
.rules-aside {
  padding: var(--split-pad-aside, var(--sp-4));
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
