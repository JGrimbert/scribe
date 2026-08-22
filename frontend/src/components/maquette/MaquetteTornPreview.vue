<template>
  <!-- Aperçu déchiré : montre les portions du chapitre qui ne sont pas présentes
       dans le folio présenté. Affichage des premiers styles avec effet déchiré
       en bas, et deuxième colonne avec un fragment par style restant. -->
  <div class="torn-preview" :style="{ '--torn-ratio': ratio }">
    <div class="torn-col torn-col--main">
      <!-- Première colonne : contenu principal avec effet déchiré en bas -->
      <div class="torn-content">
        <div class="torn-fragments">
          <div
              v-for="(fragment, index) in visibleFragments"
              :key="fragment.styleName"
              class="torn-fragment"
              :class="{
                'torn-fragment--first': index === 0,
                'torn-fragment--torn': index === visibleFragments.length - 1 && hasHiddenStyles
              }"
          >
            <div class="torn-fragment__header" v-if="fragment.title">
              <span class="torn-fragment__title">{{ fragment.title }}</span>
            </div>
            <div class="torn-fragment__body" v-html="fragment.content"></div>
          </div>
        </div>
        
        <!-- Effet déchiré en bas si des styles sont manquants -->
        <div v-if="hasHiddenStyles" class="torn-tear">
          <svg class="torn-tear__svg" viewBox="0 0 100 20" preserveAspectRatio="none">
            <path d="M0,20 C20,0 40,20 60,0 S80,20 100,0 L100,20 Z" fill="var(--c-surface)" />
          </svg>
        </div>
      </div>
    </div>
    
    <div v-if="hasHiddenStyles" class="torn-col torn-col--hidden">
      <!-- Deuxième colonne : un fragment par style restant non visible -->
      <div class="torn-hidden-styles">
        <div
            v-for="style in hiddenStyles"
            :key="style.name"
            class="torn-hidden-style"
            :title="style.name"
        >
          <div class="torn-hidden-style__label">{{ style.name }}</div>
          <div class="torn-hidden-style__preview"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Styles visibles dans le folio courant
  visibleStyles: { type: Array, default: () => [] },
  // Tous les styles du chapitre
  allStyles: { type: Array, default: () => [] },
  // Contenu des fragments
  fragments: { type: Array, default: () => [] },
  // Ratio largeur/hauteur
  ratio: { type: Number, default: 148 / 210 },
})

// Styles qui ne sont pas visibles dans le folio courant
const hiddenStyles = computed(() => {
  const visibleNames = new Set(props.visibleStyles.map(s => s.name))
  return props.allStyles.filter(s => !visibleNames.has(s.name))
})

const hasHiddenStyles = computed(() => hiddenStyles.value.length > 0)

// Fragments à afficher dans la colonne principale
const visibleFragments = computed(() => {
  // Prendre les premiers fragments qui correspondent aux styles visibles
  const visibleStyleNames = new Set(props.visibleStyles.map(s => s.name))
  
  // Filtrer les fragments dont le style est visible
  // et prendre les premiers jusqu'à remplir la colonne
  const result = []
  let currentStyleIndex = 0
  
  for (const fragment of props.fragments) {
    if (visibleStyleNames.has(fragment.styleName) && currentStyleIndex < 3) {
      result.push(fragment)
      currentStyleIndex++
    }
  }
  
  return result
})
</script>

<style scoped>
.torn-preview {
  display: flex;
  gap: 2px;
  height: 100%;
  justify-content: center;
}

.torn-col {
  flex: 0 0 auto;
  height: 100%;
  aspect-ratio: var(--torn-ratio, 0.7);
  padding: 0.9em 0.8em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  overflow: hidden;
}

/* Colonne principale */
.torn-col--main {
  border-right-width: 2px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

/* Colonne des styles cachés */
.torn-col--hidden {
  border-left-width: 2px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  display: flex;
  flex-direction: column;
  padding: 0.5em;
  gap: 0.5em;
}

.torn-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.torn-fragments {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  overflow: hidden;
}

.torn-fragment {
  flex: 0 0 auto;
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-sm);
  padding: 0.5em;
  background: color-mix(in srgb, var(--c-surface) 50%, transparent);
}

.torn-fragment--first {
  border-color: var(--c-accent-alt);
  background: color-mix(in srgb, var(--c-accent-alt) 10%, transparent);
}

.torn-fragment--torn {
  position: relative;
  margin-bottom: 0;
}

.torn-fragment__header {
  font-weight: 600;
  margin-bottom: 0.3em;
  color: var(--c-ink2);
}

.torn-fragment__title {
  font-size: var(--fs-md);
  display: block;
}

.torn-fragment__body {
  font-size: var(--fs-sm);
  color: var(--c-ink);
  line-height: 1.4;
}

/* Effet déchiré */
.torn-tear {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 12px;
  pointer-events: none;
}

.torn-tear__svg {
  width: 100%;
  height: 100%;
  stroke: var(--c-border);
  stroke-width: 0.5;
}

/* Styles cachés */
.torn-hidden-styles {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
  overflow-y: auto;
}

.torn-hidden-style {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  padding: 0.4em 0.6em;
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-surface) 70%, transparent);
  cursor: default;
}

.torn-hidden-style__label {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--c-ink2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.torn-hidden-style__preview {
  height: 0.5em;
  border-radius: 2px;
  background: color-mix(in srgb, var(--c-ink2) 20%, transparent);
}
</style>
