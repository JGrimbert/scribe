<template>
  <div class="doc-bar">
    <button
        class="doc-bar__chevron"
        :title="sidebarExpanded ? 'Replier la structure' : 'Déplier la structure'"
        @click="$emit('toggle-sidebar')"
    >
      <i class="pi" :class="sidebarExpanded ? 'pi-angle-left' : 'pi-angle-right'"></i>
    </button>

    <nav class="breadcrumb" aria-label="Fil d'Ariane">
      <button
          class="crumb crumb--root"
          :class="{ 'crumb--current': !currentNodeId }"
          :title="scoped ? 'Analyser le livre entier' : title"
          @click="$emit('select', null)"
      >
        {{ title || 'Livre' }}
      </button>

      <template v-for="crumb in crumbs" :key="crumb.id">
        <i class="pi pi-angle-right crumb-sep"></i>
        <button
            class="crumb"
            :class="{ 'crumb--current': crumb.id === currentNodeId }"
            @click="$emit('select', crumb.id)"
        >
          {{ crumb.titre }}
        </button>
      </template>
    </nav>

    <div class="analyse-cta">
      <ProgressChecklist
          v-if="checklistVisible"
          compact
          class="doc-bar__checklist"
          :items="checklistItems"
          :progress="checklistProgress"
      />
      <BaseButton
          variant="solid-alt"
          class="run-all"
          :icon="running ? null : 'pi-play'"
          :busy="!!running"
          @click="runAll"
      >
        {{ running ? `Analyse : ${STEP_LABELS[running]}…` : hasAny ? 'Relancer l’analyse' : 'Lancer l’analyse' }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { pathToInAxes } from '../script/trame'
import ProgressChecklist from './ui/ProgressChecklist.vue'
import { useAnalyse } from '../composables/useAnalyse'
import BaseButton from "./ui/BaseButton.vue";

const props = defineProps({
  title: String,
  trame: Object,
  data: Object,
  currentNodeId: String,
  sidebarExpanded: Boolean,
  // true = mode analyse (le fil d'Ariane pilote le scope), false = édition.
  scoped: Boolean,
})

defineEmits(['toggle-sidebar', 'select'])

const STEP_LABELS = {
  lexical: 'analyse linguistique',
  semantic: 'proximité sémantique',
  topics: 'thèmes',
}

// Checklist de progression d'analyse (store fourni par DocumentLayout). Visible
// seulement en mode analyse (scoped), tant que la révélation n'est pas terminée
// ou qu'une analyse tourne.
const {
  steps, stepStatus, topicsProgress, runAll,
  revealDone, running, lexical, semantic, topics
} = useAnalyse()

const crumbs = computed(() => {
  if (!props.currentNodeId || !props.trame || !props.data) return []
  return pathToInAxes(props.trame.axes, props.currentNodeId).map((id) => ({
    id,
    titre: props.data[id]?.titre || '(sans titre)',
  }))
})

const hasAny = computed(() => {
  return !!(lexical || semantic || topics)
})

const checklistItems = computed(() =>
  steps ? steps.map((step) => ({ label: step.label, status: stepStatus(step) })) : [],
)

const checklistProgress = computed(() => {
  const tp = topicsProgress.value
  return tp ? { pct: tp.pct, label: `${tp.step} (${Math.round(tp.pct)} %)` } : null
})

const checklistVisible = computed(
  () => props.scoped && !!revealDone && (!revealDone.value || running.value !== null),
)
</script>

<style scoped lang="scss">
/* Le bouton « Relancer » est la dernière case, centré comme une tuile. */

.analyse-cta {
  display: flex;
  padding-right: 0.6em;

  .run-all {
    justify-content: center;
    margin-left: 0.6em;
  }
}


.doc-bar {
  position: relative;
  flex: 0 0 auto;
  height: var(--bar-size);
  display: flex;
  align-items: center;
  background: var(--c-doc-bar-bck);
  border-bottom: var(--c-doc-bar-border);
  z-index: 99;
  overflow: hidden;
  backdrop-filter: blur(4px);
}

/* Le chevron occupe exactement la largeur du rail : il se pose au-dessus de la
   sidebar repliée, prolongeant visuellement la colonne (« fondu »). */
.doc-bar__chevron {
  flex: 0 0 auto;
  width: var(--bar-size);
  height: var(--bar-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: var(--op-soft);
}

.doc-bar__chevron:hover {
  opacity: 1;
}

.breadcrumb {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.15em;
  overflow: hidden;
  white-space: nowrap;
  padding-right: 0.6em;
}

.crumb {
  flex: 0 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
  padding: 0.15em 0.35em;
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: var(--op-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  /* Casse unifiée avec la sidebar (crumb = item flex, donc blockifié —
     ::first-letter s'applique). */
  text-transform: lowercase;
}

.crumb::first-letter {
  text-transform: uppercase;
}

.crumb--root {
  font-weight: 500;
  flex-shrink: 0;
}

.crumb:hover {
  opacity: 1;
  background: var(--c-hover);
}

.crumb--current {
  opacity: 1;
  color: var(--c-bar-accent);
  font-weight: 600;
}

.crumb-sep {
  flex: 0 0 auto;
  font-size: 0.7em;
  opacity: var(--op-faint);
}

/* Checklist à l'extrémité droite : le fil d'Ariane (flex 1) la pousse au bord,
   elle tronque avant de forcer la barre à déborder. */
.doc-bar__checklist {
  flex: 0 1 auto;
  min-width: 0;
  padding-right: 0.6em;
}
</style>
