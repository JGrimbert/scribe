<template>
  <!-- Overlay deux colonnes en mode visualisation -->
  <div v-if="presentationMode === 'visualization'" class="maq-viz-overlay">
    <!-- Colonne 1 : Contenu visible page 1 (avec rupture déchirée) -->
    <div class="maq-viz-col maq-viz-col--visible">
      <div class="maq-viz-content">
        <!-- Le FolioView existant s'affiche ici, sa hauteur est limitée -->
        <div class="maq-viz-folio-wrapper">
          <slot name="folio" />
        </div>
        <!-- Effet de rupture déchirée au bas -->
        <div class="maq-viz-tear" />
      </div>
    </div>

    <!-- Colonne 2 : Aperçu des styles restants -->
    <div class="maq-viz-col maq-viz-col--remaining">
      <div v-if="remainingStyles.length > 0" class="maq-viz-placeholders">
        <div
            v-for="style in remainingStyles"
            :key="style"
            class="maq-viz-placeholder"
        >
          <div class="maq-viz-placeholder__label">{{ style }}</div>
          <div class="maq-viz-placeholder__preview" />
        </div>
      </div>
      <div v-else class="maq-viz-empty">Aucun style restant</div>
    </div>
  </div>
  <!-- Sinon, afficher le contenu normal -->
  <slot v-else name="folio" />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  presentationMode: { type: String, default: 'standard' },
  // Styles visibles sur page 1
  visibleStyles: { type: Array, default: () => [] },
  // Styles du chapitre complet (pour calculer les restants)
  chapitreStyles: { type: Array, default: () => [] },
})

// Calcule les styles qui ne sont pas visibles page 1
const remainingStyles = computed(() => {
  const visibleSet = new Set(props.visibleStyles)
  return props.chapitreStyles.filter((style) => !visibleSet.has(style))
})
</script>

<style scoped>
/* Overlay deux colonnes -->
.maq-viz-overlay {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2em;
  align-items: start;
  width: 100%;
  height: 100%;
}

/* Colonne 1 : Contenu visible avec rupture -->
.maq-viz-col--visible {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.maq-viz-content {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Wrapper du folio : limite la hauteur -->
.maq-viz-folio-wrapper {
  height: 100%;
  overflow: hidden;
}

/* Effet de rupture « déchirée » au bas -->
.maq-viz-tear {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2em;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.05) 50%,
    rgba(0, 0, 0, 0.1) 100%
  );
  pointer-events: none;
  /* Effet de dents pour suggérer une rupture -->
  clip-path: polygon(
    0% 0%,
    2% 20%,
    4% 0%,
    6% 25%,
    8% 5%,
    10% 20%,
    12% 0%,
    14% 25%,
    16% 10%,
    18% 20%,
    20% 0%,
    22% 25%,
    24% 5%,
    26% 20%,
    28% 0%,
    30% 25%,
    32% 10%,
    34% 20%,
    36% 0%,
    38% 25%,
    40% 5%,
    42% 20%,
    44% 0%,
    46% 25%,
    48% 10%,
    50% 20%,
    52% 0%,
    54% 25%,
    56% 5%,
    58% 20%,
    60% 0%,
    62% 25%,
    64% 10%,
    66% 20%,
    68% 0%,
    70% 25%,
    72% 5%,
    74% 20%,
    76% 0%,
    78% 25%,
    80% 10%,
    82% 20%,
    84% 0%,
    86% 25%,
    88% 5%,
    90% 20%,
    92% 0%,
    94% 25%,
    96% 10%,
    98% 20%,
    100% 0%,
    100% 100%,
    0% 100%
  );
}

/* Colonne 2 : Aperçu des styles restants -->
.maq-viz-col--remaining {
  display: flex;
  flex-direction: column;
  gap: 1em;
  padding-top: 1em;
}

.maq-viz-placeholders {
  display: flex;
  flex-direction: column;
  gap: 1.5em;
}

.maq-viz-placeholder {
  padding: 1em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-surface) 50%, transparent);
}

.maq-viz-placeholder__label {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-ink);
  margin-bottom: 0.5em;
  text-transform: capitalize;
}

.maq-viz-placeholder__preview {
  width: 100%;
  height: 3em;
  background: linear-gradient(
    135deg,
    var(--c-surface) 0%,
    color-mix(in srgb, var(--c-surface) 80%, var(--c-accent-alt))
  );
  border-radius: 2px;
  opacity: 0.6;
}

.maq-viz-empty {
  padding: 2em 1em;
  text-align: center;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
  opacity: var(--op-muted);
}
</style>
