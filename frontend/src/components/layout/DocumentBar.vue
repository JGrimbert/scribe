<template>
  <div ref="barEl" class="doc-bar">
    <button
        v-if="hasSidebar"
        class="doc-bar__chevron"
        :title="`${sidebarExpanded ? 'Replier' : 'Déplier'} ${asideLabel}`"
        @click="$emit('toggle-sidebar')"
    >
      <i class="pi" :class="sidebarExpanded ? 'pi-angle-left' : 'pi-angle-right'"></i>
    </button>

    <nav class="breadcrumb" aria-label="Fil d'Ariane">
      <!-- Ordre : projet › chapitrage › page › section. La feuille (dernier
           maillon effectif) porte l'accent, les intermédiaires restent neutres. -->
      <button
          class="crumb crumb--root"
          :title="scoped ? 'Analyser le livre entier' : title"
          @click="$emit('select', null)"
      >
        {{ title || 'Livre' }}
      </button>

      <!-- Chapitrage : chemin de nœuds (chapitre ouvert en édition, scope en analyse). -->
      <template v-for="crumb in crumbs" :key="crumb.id">
        <i class="pi pi-angle-right crumb-sep"></i>
        <button class="crumb" @click="$emit('select', crumb.id)">
          {{ crumb.titre }}
        </button>
      </template>

      <!-- Page : inerte (span, pas bouton) — on y est déjà, rien à y naviguer.
           Feuille accentuée tant qu'aucune section ne la suit. -->
      <template v-if="screenLabel">
        <i class="pi pi-angle-right crumb-sep"></i>
        <span class="crumb crumb--screen" :class="{ 'crumb--current': !section }">{{ screenLabel }}</span>
      </template>

      <!-- Section en cours DANS la page (feuille) : nuage de mots… en analyse,
           Format/Liminaire/Chapitrage en maquette. Inerte. -->
      <template v-if="section">
        <i class="pi pi-angle-right crumb-sep"></i>
        <span class="crumb crumb--section crumb--current">{{ section }}</span>
      </template>
    </nav>

    <!-- Recherche inline : loupe sortie du champ, input pavé pleine hauteur.
         Le focus ouvre un volet pleine largeur. ABSENTE en maquette : là, le
         champ ET son volet vivent dans la carte du sommaire flottant
         (MaquetteStructureNav) — un seul module, un seul cadre. -->
    <label v-if="!inMaquette" ref="searchEl" class="doc-search">
      <i class="pi pi-search doc-search__icon"></i>
      <input
          ref="inputEl"
          v-model="query"
          type="search"
          class="doc-search__input"
          placeholder="Rechercher…"
          @focus="open = true"
          @blur="onInputBlur"
      />
    </label>

    <!-- Sans champ, rien ne pousse le CTA à droite : ce vide s'en charge. -->
    <div v-else class="doc-bar__spacer"></div>

    <!-- Volet déroulant : téléporté dans body pour échapper au containing-block
         créé par le `backdrop-filter` de la barre (qui clipperait un enfant fixe).
         `--c-bar-accent` n'existe pas hors `.app` → on injecte sa valeur calculée
         lue sur la barre. Voile plein écran portant le panneau (stats, onglets,
         nuage), le même qu'héberge la carte du sommaire en maquette. -->
    <Teleport to="body">
      <div
          v-if="open"
          ref="panelEl"
          class="doc-panel"
          :style="[panelStyle, { '--c-bar-accent': barAccent }]"
      >
        <!-- Un résultat cliqué vaut un clic dans le fil d'Ariane (navigation ou
             scope selon l'écran, arbitré par DocumentLayout) et referme le volet. -->
        <DocSearchPanel
            :width="panelWidth"
            :query="query"
            @select-node="$emit('select', $event); open = false"
        />
      </div>
    </Teleport>

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
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { pathToInAxes } from '../../script/trame'
import ProgressChecklist from '../ui/molecules/ProgressChecklist.vue'
import DocSearchPanel from './DocSearchPanel.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import BaseButton from "../ui/atoms/BaseButton.vue";

const props = defineProps({
  title: String,
  trame: Object,
  data: Object,
  currentNodeId: String,
  sidebarExpanded: Boolean,
  // Faux là où l'écran n'a pas d'aside gauche (la maquette, qui porte son propre
  // sommaire flottant) : le chevron de repli n'aurait alors rien à replier.
  hasSidebar: { type: Boolean, default: true },
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
  // Section en cours DANS la page (dernier maillon du fil d'Ariane) : posée par
  // la vue routée (scroll-spy en analyse, cran focusé en maquette). null ailleurs.
  section: { type: String, default: null },
})

defineEmits(['toggle-sidebar', 'select', 'toggle-validation'])

// Saisie retenue localement, pas encore branchée sur une recherche.
const query = ref('')

// ── Volet de recherche (déroulant) ───────────────────────────────────────────
const open = ref(false)
const barEl = ref(null)
const searchEl = ref(null)
const inputEl = ref(null)
const panelEl = ref(null)

// La bande de stats reprend la couleur du menu (`--c-bar-accent`, thématisée).
// Le volet étant téléporté hors de `.app`, ce token n'y cascade pas — on lit sa
// valeur calculée sur la barre à chaque ouverture (le thème peut avoir changé).
const barAccent = ref('')

// Le volet est un VOILE PLEIN ÉCRAN (même calque que le sommaire flottant de la
// maquette, cf. --c-veil) : il couvre tout sous les deux barres. Téléporté dans
// body, il n'hérite pas du flux — seul son `top` se mesure (bas de la doc-bar,
// dont la hauteur n'est pas exposée en token), le reste vient du CSS. La largeur
// de l'input reste mesurée : elle pilote le nombre de mots par défaut du nuage.
const panelStyle = ref({})
const panelWidth = ref(0)
function positionPanel() {
  const r = inputEl.value?.getBoundingClientRect()
  if (r) panelWidth.value = r.width
  const b = barEl.value?.getBoundingClientRect()
  if (b) panelStyle.value = { top: `${b.bottom}px` }
}

// Fermeture : Échap, ou clic hors de l'input ET hors du volet (téléporté, donc
// pas dans l'arbre de la barre — on teste les deux conteneurs à la main).
function onDocKeydown(e) {
  if (e.key === 'Escape') open.value = false
}
function onDocMousedown(e) {
  // Seul le clic gauche ferme : un clic droit (menu contextuel) ne doit pas
  // faire disparaître le volet.
  if (e.button !== 0) return
  if (inputEl.value?.contains(e.target) || panelEl.value?.contains(e.target)) return
  open.value = false
}
// Perte de focus de l'input → fermeture, sauf si le focus part DANS le volet
// (interaction avec un contrôle du nuage : select, chips).
function onInputBlur(e) {
  if (panelEl.value?.contains(e.relatedTarget)) return
  open.value = false
}
watch(open, (isOpen) => {
  if (isOpen) {
    if (barEl.value) {
      barAccent.value = getComputedStyle(barEl.value).getPropertyValue('--c-bar-accent').trim()
    }
    positionPanel()
  }
  const m = isOpen ? 'addEventListener' : 'removeEventListener'
  document[m]('keydown', onDocKeydown)
  document[m]('mousedown', onDocMousedown)
  window[m]('resize', positionPanel)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onDocKeydown)
  document.removeEventListener('mousedown', onDocMousedown)
  window.removeEventListener('resize', positionPanel)
})

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
  running, lexical, semantic, topics,
} = useAnalyse()

// Nom de l'écran, en tête du fil d'Ariane. Lu ici plutôt que reçu en prop :
// c'est du vocabulaire d'affichage, `DocumentLayout` n'a pas à en arbitrer.
// `scoped` ne suffirait pas — il ne sépare que l'édition du reste.
const SCREEN_LABELS = {
  maquette: 'Maquette',
  document: 'Analyse',
  editor: 'Édition',
}

const route = useRoute()
// La maquette est une FAMILLE de routes (coquille + jalons `maquette-*`) : tous
// portent le libellé d'écran « Maquette ».
const isMaquetteRoute = computed(() => route.name?.startsWith('maquette') ?? false)
const screenLabel = computed(() =>
  isMaquetteRoute.value ? SCREEN_LABELS.maquette : (SCREEN_LABELS[route.name] ?? null),
)

// La maquette héberge elle-même le champ de recherche (dans la carte du
// sommaire flottant) : la barre lui laisse la place.
const inMaquette = computed(() => isMaquetteRoute.value)

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
  padding-left: 2em;
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
  flex: 0 1 auto;
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

/* Page et section : maillons inertes (ni clic ni survol). L'accent de feuille
   vient de `crumb--current`, posé sur le dernier maillon effectif — la page tant
   qu'aucune section ne la suit, la section sinon. */
.crumb--screen,
.crumb--section {
  flex-shrink: 0;
  cursor: default;
}

.crumb:hover {
  opacity: 1;
  background: var(--c-hover);
}

/* Les maillons inertes ne réagissent pas au survol (le fond `--c-hover` les
   ferait passer pour cliquables) ; un maillon non-feuille garde son opacité douce. */
.crumb--screen:hover,
.crumb--section:hover {
  background: transparent;
}

.crumb--screen:not(.crumb--current):hover {
  opacity: var(--op-soft);
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

/* Recherche inline : la loupe est SORTIE de l'input (élément à gauche, hors du
   cadre). L'input est un pavé pleine hauteur, bordé à gauche/droite seulement,
   avec une ombre interne douce sur son bord gauche. */
.doc-search {
  flex: 1 1 auto;
  min-width: 0;
  align-self: stretch;
  display: flex;
  align-items: center;
}

.doc-search__icon {
  flex: 0 0 auto;
  padding: 0 0.55em;
  font-size: 0.9em;
  opacity: var(--op-muted);
}

.doc-search__input {
  align-self: stretch;
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  margin: 0;
  padding: 0 0.7em;
  border: 0;
  border-left: 1px solid rgba(0, 0, 0, 0.15);
  border-right: 1px solid rgba(0, 0, 0, 0.15);
  box-shadow: inset 6px 0 6px -6px rgba(0, 0, 0, 0.28);
  background: rgba(255, 255, 255, 0.18);
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
}

.doc-search__input:focus {
  outline: none;
}

.doc-search__input::placeholder {
  color: inherit;
  opacity: var(--op-faint);
}

/* Chrome/Safari : retire la croix native du type=search (double emploi visuel). */
.doc-search__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

/* ── Volet de recherche (téléporté dans body) ─────────────────────────────────
   VOILE PLEIN ÉCRAN, du bas de la doc-bar (top mesuré, inline) au bas du
   viewport. Un seul fond, ici : le panneau (DocSearchPanel) n'ajoute ni voile ni
   flou, il est aussi monté dans la carte du sommaire en maquette. */
.doc-panel {
  position: fixed;
  /* `top` posé en style inline (bas de la doc-bar). */
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 150;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--c-veil);
  backdrop-filter: var(--c-veil-blur);
}

/* Le vide qui remplace le champ là où l'écran l'héberge lui-même (maquette). */
.doc-bar__spacer {
  flex: 1 1 auto;
}

/* Checklist à l'extrémité droite : le fil d'Ariane (flex 1) la pousse au bord,
   elle tronque avant de forcer la barre à déborder. */
.doc-bar__checklist {
  flex: 0 1 auto;
  min-width: 0;
  padding-right: 0.6em;
}
</style>
