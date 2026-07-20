<template>
  <!-- Split : main = l'accordéon des vis-à-vis (la composition), aside = le
       découpage du vis-à-vis focusé puis le verdict d'éligibilité. Cadre effacé
       (bare), l'aside porte sa bordure.
       Cet orchestrateur ne rend rien lui-même : il détient l'état partagé
       (config mutée en place, focus) et le distribue. -->
  <AnalyseBlock aside="right" bare>
    <template #main>
      <!-- Un décalage de borne n'est qu'une PRÉVISUALISATION : les entrées
           absorbées ne sont dans aucune base tant que le recalibrage n'a pas
           reconstruit l'arbre. Le dire fort, sinon on croit avoir enregistré. -->
      <UiCallout v-if="borderShift > 0" tone="error" title="Aperçu — rien n'est enregistré" class="shift-note">
        <div class="shift-body">
          <span>
            Liminaire étendu de <strong>{{ borderShift }}</strong>
            {{ borderShift > 1 ? 'chapitres' : 'chapitre' }}. Seul un recalibrage déplace la borne
            pour de bon — enregistrer la configuration ne la retiendra pas.
          </span>
          <BaseButton variant="outline" icon="pi-refresh" :disabled="!recalibratable" :busy="starting" @click="$emit('redefine')">
            Redéfinir le liminaire
          </BaseButton>
        </div>
      </UiCallout>

      <LiminaireAccordeon
          :spreads="spreads"
          :focused="focused"
          :types="types"
          :suggestions="suggestions"
          :sides="sides"
          :expected-sides="expectedSides"
          :conflicts="conflicts"
          :recalibratable="recalibratable"
          :starting="starting"
          :recal-error="recalError"
          :border-shift="borderShift"
          :can-extend="canExtend"
          :next-title="nextTitle"
          @update:focused="focused = $event"
          @set-type="onSetType"
          @set-side="onSetSide"
          @extend="$emit('extend')"
          @exclude="$emit('exclude')"
          @redefine="$emit('redefine')"
      />
    </template>

    <template #aside>
      <div class="lim-aside">
        <section class="lim-group lim-group--edit">
          <!-- Le découpage suit le FOCUS : dérouler tout le liminaire à côté
               d'un vis-à-vis unique obligeait à chercher, dans une liste de
               dix pages, les deux qu'on a sous les yeux. -->
          <h4 class="lim-title">Découpage</h4>
          <p class="lim-scope">{{ scopeLabel }}</p>
          <LiminaireDecoupage :pages="focusedPages" :config="config" :empty-label="emptyLabel" />
        </section>

        <section class="lim-group lim-group--verdict">
          <h4 class="lim-title">Éligibilité</h4>
          <LiminaireEligibilite :elig="elig" />
        </section>
      </div>
    </template>
  </AnalyseBlock>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AnalyseBlock from './analyse/AnalyseBlock.vue'
import BaseButton from './ui/BaseButton.vue'
import UiCallout from './ui/UiCallout.vue'
import LiminaireAccordeon from './liminaire/LiminaireAccordeon.vue'
import LiminaireDecoupage from './liminaire/LiminaireDecoupage.vue'
import LiminaireEligibilite from './liminaire/LiminaireEligibilite.vue'
import {
  LIMINAIRE_BY_KEY,
  computeImposition,
  deriveEligibility,
  expectedSideOf,
  isConflicting,
  pagesOfSpread,
  setPageSide,
  setPageType,
  sideOfPage,
  toSpreads,
  typeOfPage,
} from '../script/liminaire'
import { suggestAll } from '../script/liminaire-suggest'

const props = defineProps({
  pages: { type: Array, required: true },
  // Muté EN PLACE (comme RuleSetForm) : le parent détient l'objet réactif, keyé
  // par ENTRÉE. `type`/`side` = tag de la page ancrée ; `break` = frontière.
  config: { type: Object, required: true },
  // Titre du livre : départage faux-titre (titre seul) et page de titre.
  title: { type: String, default: '' },
  // Déplacer une borne passe par un recalibrage, qui exige le .odt d'origine.
  recalibratable: { type: Boolean, default: true },
  starting: { type: Boolean, default: false },
  recalError: { type: String, default: null },
  // Déplacement local de la borne, en nombre de chapitres absorbés (cf.
  // script/liminaire-bornes). Toujours >= 0 : on ne peut pas mordre sur le
  // liminaire d'origine, dont les paragraphes précèdent le premier titre.
  borderShift: { type: Number, default: 0 },
  canExtend: { type: Boolean, default: true },
  // Titre du prochain chapitre absorbable — ce que « Étendre » promet.
  nextTitle: { type: String, default: null },
})

defineEmits(['extend', 'exclude', 'redefine'])

const elig = computed(() => deriveEligibility(props.pages, props.config))

// Folios physiques (avec blanches implicites de parité) regroupés en planches.
// Chaque page reçoit son côté choisi ET la convention de son type (l'ancre de
// parité), cf. effectiveSide.
const spreads = computed(() =>
  toSpreads(
    computeImposition(
      props.pages.map((p) => ({
        ...p,
        side: sideOfPage(props.config, p),
        typeSide: LIMINAIRE_BY_KEY.get(typeOfPage(props.config, p))?.side ?? 'auto',
      })),
    ),
  ),
)

// Suggestions DÉTERMINISTES (style-name + mots-clés + titre), instantanées. Une
// proposition, pas une décision : rien n'est persisté tant que l'utilisateur ne
// l'applique pas (même philosophie que la typologie des styles).
const deterministic = computed(() => suggestAll(props.pages, { title: props.title }))

// L'accordéon est présentationnel : il reçoit types et suggestions résolus,
// keyés par page, plutôt que la config brute.
const types = computed(() =>
  Object.fromEntries(props.pages.map((p) => [p.key, typeOfPage(props.config, p)])),
)

const suggestions = computed(() =>
  Object.fromEntries(
    props.pages
      .filter((p) => deterministic.value[p.key])
      .map((p) => [p.key, { key: deterministic.value[p.key].key, why: deterministic.value[p.key].why }]),
  ),
)

// Le côté vit désormais dans l'accordéon, contre le type qui le conditionne —
// il n'a plus sa place dans le découpage, qui ne parle que de frontières.
const sides = computed(() =>
  Object.fromEntries(props.pages.map((p) => [p.key, sideOfPage(props.config, p)])),
)

const expectedSides = computed(() =>
  Object.fromEntries(props.pages.map((p) => [p.key, expectedSideOf(props.config, p)])),
)

const conflicts = computed(() =>
  Object.fromEntries(props.pages.map((p) => [p.key, isConflicting(props.config, p)])),
)

// Des handlers nommés, pas des appels inline : l'événement porte DEUX arguments
// (page, valeur) et un template n'expose que le premier via `$event`.
function onSetType(page, value) {
  setPageType(props.config, page, value)
}

function onSetSide(page, value) {
  setPageSide(props.config, page, value)
}

// ─── Focus : partagé entre l'accordéon et le découpage ───────────────────────
// Il vit ici, et non dans l'accordéon, précisément parce que le découpage en
// dépend — c'est le seul état que les deux colonnes ont en commun.
const focused = ref(0)

// Le cran terminal (étendre le liminaire) occupe la position `spreads.length`.
const slideCount = computed(() => spreads.value.length + 1)

// Les frontières bougent (fusion/scission) → le focus peut sortir de la liste.
watch(slideCount, (n) => {
  if (focused.value > n - 1) focused.value = Math.max(0, n - 1)
})

const focusedPages = computed(() => pagesOfSpread(spreads.value[focused.value]))

const onExtendSlide = computed(() => focused.value === spreads.value.length)

const scopeLabel = computed(() => {
  if (onExtendSlide.value) return 'Fin du liminaire'
  const nums = focusedPages.value.map((p) => p.ordinal + 1)
  if (!nums.length) return `Vis-à-vis ${focused.value + 1}`
  return nums.length > 1 ? `Pages ${nums[0]} et ${nums[nums.length - 1]}` : `Page ${nums[0]}`
})

const emptyLabel = computed(() =>
  onExtendSlide.value
    ? "Ce cran n'est pas une page : il étend le liminaire."
    : 'Ce vis-à-vis ne porte que des blanches de parité — rien à découper.',
)
</script>

<style scoped>
.shift-note { margin-bottom: var(--sp-3); }

.shift-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}

.lim-aside { padding: var(--split-pad-aside, var(--sp-4)); }

/* Deux registres, et c'est le propos de les séparer visuellement : le Découpage
   est une SURFACE DE TRAVAIL (on y clique, on y scinde), l'Éligibilité un
   VERDICT (on le lit, on n'y touche pas). Identiques, on cherchait dans l'un
   les contrôles de l'autre. */
.lim-group {
  padding: var(--sp-3);
  border-radius: var(--radius-md);
}

.lim-group + .lim-group { margin-top: var(--sp-4); }

/* Surface de travail : posée en relief, cadre plein. */
.lim-group--edit {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}

/* Verdict : pas de fond, pas de cadre — un simple filet en tête, qui le
   rattache à ce qui précède sans lui donner l'air d'un formulaire. */
.lim-group--verdict {
  padding-left: 0;
  padding-right: 0;
  border-top: 1px solid var(--c-border);
  border-radius: 0;
}

.lim-title {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 600;
}

/* Dit SUR QUOI porte le découpage : sans lui, une liste qui change au fil du
   focus passe pour un bug. */
.lim-scope {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  opacity: var(--op-muted);
}
</style>
