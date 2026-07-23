<template>
  <div class="doc-bar">
    <button
        class="doc-bar__chevron"
        :title="`${sidebarExpanded ? 'Replier' : 'Déplier'} ${asideLabel}`"
        @click="$emit('toggle-sidebar')"
    >
      <i class="pi" :class="sidebarExpanded ? 'pi-angle-left' : 'pi-angle-right'"></i>
    </button>

    <nav class="breadcrumb" aria-label="Fil d'Ariane">
      <!-- Inerte (span, pas bouton) : on est déjà sur cet écran, il n'y a rien
           à y naviguer — c'est un titre, pas un maillon. -->
      <template v-if="screenLabel">
        <span class="crumb crumb--screen">{{ screenLabel }}</span>
        <i class="pi pi-angle-right crumb-sep"></i>
      </template>

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

    <!-- Validation : seulement en édition, et seulement sur un chapitre ouvert
         — on valide ce qu'on vient de relire, sous les yeux. Le dashboard, lui,
         ne fait que compter. -->
    <BaseButton
        v-if="!scoped && currentNodeId"
        class="validate"
        :class="`validate--${validationState ?? 'aucune'}`"
        :variant="validationState ? 'ghost' : 'outline'"
        :icon="VALIDATION_UI[validationState ?? 'aucune'].icon"
        :busy="validating"
        :title="VALIDATION_UI[validationState ?? 'aucune'].title"
        @click="$emit('toggle-validation', currentNodeId)"
    >
      {{ VALIDATION_UI[validationState ?? 'aucune'].label }}
    </BaseButton>

    <!-- CTA global à droite : un slot, un CTA contextuel. Une action posée par
         l'écran (`barAction` — ex : « Redéfinir les bornes » en config) prend la
         place du CTA d'analyse propre au dashboard. -->
    <div class="analyse-cta">
      <BaseButton
          v-if="barAction"
          variant="solid-alt"
          class="run-all"
          :icon="barAction.icon"
          :disabled="barAction.disabled"
          :busy="barAction.busy"
          :title="barAction.title"
          @click="barAction.run"
      >
        {{ barAction.label }}
      </BaseButton>

      <template v-else>
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
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { pathToInAxes } from '../../script/trame'
import ProgressChecklist from '../ui/molecules/ProgressChecklist.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import BaseButton from "../ui/atoms/BaseButton.vue";

const props = defineProps({
  title: String,
  trame: Object,
  data: Object,
  currentNodeId: String,
  sidebarExpanded: Boolean,
  // Ce que le chevron replie — l'aside est contextuelle (structure ou registre),
  // son libellé ne peut donc pas être en dur ici.
  asideLabel: { type: String, default: 'la structure' },
  // true = mode analyse (le fil d'Ariane pilote le scope), false = édition.
  scoped: Boolean,
  // État de validation du chapitre courant : 'validé', 'périmé', ou null.
  validationState: { type: String, default: null },
  validating: Boolean,
  // Action contextuelle de l'écran, posée dans le CTA global à droite à la place
  // du bouton d'analyse. `{ label, icon, disabled, busy, title, run }` ou null.
  barAction: { type: Object, default: null },
})

defineEmits(['toggle-sidebar', 'select', 'toggle-validation'])

// Les trois états du bouton. « périmé » ne propose pas de dévalider mais de
// revalider : le texte a changé depuis la relecture, l'action utile est de
// relire, pas d'effacer la trace.
const VALIDATION_UI = {
  aucune: { icon: 'pi-check', label: 'Valider', title: 'Marquer ce chapitre comme relu' },
  validé: { icon: 'pi-check-circle', label: 'Validé', title: 'Retirer la validation' },
  périmé: { icon: 'pi-exclamation-triangle', label: 'Revalider', title: 'Le texte a changé depuis la relecture — revalider' },
}

const STEP_LABELS = {
  lexical: 'analyse linguistique',
  semantic: 'proximité sémantique',
  topics: 'thèmes',
}

// Checklist de progression d'analyse (store fourni par DocumentLayout).
const {
  steps, stepStatus, topicsProgress, runAll,
  running, lexical, semantic, topics
} = useAnalyse()

// Nom de l'écran, en tête du fil d'Ariane. Lu ici plutôt que reçu en prop :
// c'est du vocabulaire d'affichage, `DocumentLayout` n'a pas à en arbitrer.
// `scoped` ne suffirait pas — il ne sépare que l'édition du reste.
const SCREEN_LABELS = {
  config: 'Configuration',
  document: 'Analyse',
  editor: 'Édition',
}

const route = useRoute()
const screenLabel = computed(() => SCREEN_LABELS[route.name] ?? null)

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

// La checklist rend compte d'une analyse EN COURS. Au repos elle affichait un
// état figé que plus rien ne faisait avancer — du bruit permanent dans la barre.
// Le bouton « Lancer / Relancer », lui, reste visible : c'est la porte d'entrée.
const checklistVisible = computed(() => props.scoped && !!running && running.value !== null)
</script>

<style scoped lang="scss">
/* Bouton de validation : les deux états « décidés » portent leur couleur de
   statut (mêmes tokens que le graphe de complétude — un chapitre vert dans la
   barre est un chapitre vert dans le graphe), l'état neutre reste un outline. */
.validate {
  flex: 0 0 auto;
  margin-right: 0.4em;
  white-space: nowrap;

  &--validé {
    color: var(--c-status-valide);
  }

  &--périmé {
    color: var(--c-status-perime);
  }
}

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

/* Titre de l'écran : ni survol ni clic, mais la métrique des crumbs pour que la
   ligne reste d'un seul tenant. */
.crumb--screen {
  flex-shrink: 0;
  opacity: 1;
  font-weight: 600;
  color: var(--c-bar-accent);
  cursor: default;
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
