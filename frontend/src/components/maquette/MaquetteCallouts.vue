<template>
  <!-- Callouts ancrés au folio, montés À L'INTÉRIEUR d'un `.folio-slot` de la coquille
       (MaquetteView) : le transform du slot les fait GLISSER avec sa planche pendant une
       bascule (ils ne sont plus effacés le temps de la transition). Aiguillés par la
       SOURCE de la vue portée par ce slot (frozen pour la sortante, live pour l'entrante).
       - `view` : descriptif FIGÉ avec la vue (source + données par-vis-à-vis qui, elles,
         changent d'un cran à l'autre : styles du spread, spread liminaire, section) ;
       - `geometry` : la géométrie émise par LE FolioView de CE slot ({ spread, block,
         style }) — chaque overlay se recale sur l'origine de son propre root, donc sur le
         slot qui le porte (patron origine-locale de MaquetteFormatCallouts) ;
       - `interactive` : seule la vue live pilote le modèle (survol/typage) ; la sortante
         figée est inerte (elle ne fait que glisser dehors).
       Les données STABLES sur la durée d'un slide (rôles, types, config, styleDefaults…)
       sont injectées en direct — inutile de les figer. -->
  <div class="mc" :class="{ 'mc--inert': !interactive }">
    <template v-if="view?.source === 'maquette'">
      <MaquetteFormatCallouts :page="fmtPage" :style-defaults="styleDefaults" :geometry="geometry.spread" />
    </template>

    <template v-else-if="view?.source === 'liminaire'">
      <BlockOutlines :blocks="geometry.block" />
      <MaquetteStyleCallouts
          :geometry="geometry.spread"
          :style-geometry="geometry.style"
          :styles="view.limStyles"
          :style-roles="styles"
          @hover-style="onHoverStyle"
      />
      <div v-if="presentationMode !== 'torn'" class="mc__lim">
        <LiminaireControls
            :geometry="geometry.spread"
            :spread="view.limSpread"
            :types="limTypes"
            :suggestions="limSuggestions"
            @set-type="onSetType"
        />
      </div>
    </template>

    <template v-else-if="view?.source === 'chapitrage'">
      <BlockOutlines :blocks="geometry.block" />
      <MaquetteStyleCallouts
          :geometry="geometry.spread"
          :style-geometry="geometry.style"
          :styles="view.chapStyles"
          :style-roles="styles"
          show-require
          :depth-key="view.section?.depthKey ?? null"
          :rule-set="view.section?.ruleSet ?? rules.default"
          @hover-style="onHoverStyle"
      />
    </template>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import MaquetteFormatCallouts from './MaquetteFormatCallouts.vue'
import MaquetteStyleCallouts from './MaquetteStyleCallouts.vue'
import BlockOutlines from './BlockOutlines.vue'
import LiminaireControls from '../liminaire/LiminaireControls.vue'

const props = defineProps({
  // Descriptif de callouts figé avec la vue (cf. MaquetteView.liveView.callouts).
  view: { type: Object, default: null },
  // Géométrie émise par le FolioView de CE slot : { spread, block, style }.
  geometry: { type: Object, required: true },
  // Vue live (pilote le modèle) vs vue figée sortante (inerte, glisse dehors).
  interactive: { type: Boolean, default: false },
})

// Données stables sur la durée d'un slide (le modèle n'en change pas en 550 ms) —
// injectées en direct plutôt que figées dans `view`.
const {
  styles, fmtPage, styleDefaults, limTypes, limSuggestions,
  rules, setHoveredStyle, limSetType, presentationMode,
} = inject('maq')

// Seule la vue live pilote le modèle ; la sortante figée ne fait que glisser dehors.
function onHoverStyle(name) {
  if (props.interactive) setHoveredStyle(name)
}
function onSetType(page, value) {
  if (props.interactive) limSetType(page, value)
}
</script>

<style scoped>
.mc {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Overlay des contrôles liminaire (racine inerte, chaque contrôle rétablit le pointeur ;
   au-dessus de l'iframe, z-index 1 en double-page). */
.mc__lim {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

/* Vue figée sortante : totalement inerte (elle ne fait que glisser dehors) — on force
   TOUS les descendants, sinon les contrôles à `pointer-events:auto` resteraient cliquables. */
.mc--inert,
.mc--inert :deep(*) {
  pointer-events: none !important;
}
</style>
