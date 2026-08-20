<template>
  <!-- Scène d'analyse frag (nuage / cards), EN REGARD des lambeaux. Vit dans la COQUILLE
       (pas le pane routé) pour survivre au changement de route et GLISSER en entrée ET en
       sortie. Le CLIP (fixed, sous les barres, overflow hidden) borne le glissement à la
       zone folio ; la couche interne porte le transform du slide (`slideStyle`). Contenu
       et ancrage FIGÉS pour la scène sortante via le prop `scene`. -->
  <div
      class="maq-analyse-clip"
      :style="{ left: scene.analyseLeft, right: scene.isCloudView ? 'var(--sp-4)' : scene.analyseColumn }"
  >
    <div ref="cloudEl" class="maq-analyse" :style="slideStyle">
      <!-- Sélecteur du type porté par le grand nuage : rangée de chips posée sur la scène. -->
      <div v-if="scene.isCloudView" class="maq-cloud-cats">
        <BaseChip
            v-for="cat in CLOUD_CATEGORIES"
            :key="cat.key"
            :active="cat.key === mainCategory"
            @click="mainCategory = cat.key"
        >{{ cat.label }}</BaseChip>
      </div>
      <VocabulaireCloud
          v-if="scene.isCloudView"
          compact
          :category="mainCategory"
          :width="cloudW"
          :height="cloudH"
          :dims="CLOUD_DIMS"
      />
      <CustomScrollbar v-else-if="analyseCards.length" class="maq-analyse__scroll">
        <component v-for="c in analyseCards" :key="c.key" :is="c.comp" />
      </CustomScrollbar>
      <p v-else class="maq-analyse__empty">{{ focusedLayer?.label }}</p>
    </div>
  </div>

  <!-- Colonne des asides des cards (hors nuage) : les blocs y téléportent leur #aside. -->
  <div v-if="!scene.isCloudView" class="maq-analyse-aside-clip" :style="{ width: scene.analyseColumn }">
    <div class="maq-analyse-aside" :style="slideStyle">
      <CustomScrollbar>
        <div ref="analyseAsideEl" class="maq-analyse-aside__inner split-aside"></div>
      </CustomScrollbar>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, provide, inject, onUnmounted } from 'vue'
import VocabulaireCloud from '../analyse/lexical/VocabulaireCloud.vue'
import BaseChip from '../ui/atoms/BaseChip.vue'
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'

defineProps({
  // Transform/transition du slide (mirroir du slot de la vue) — appliqué à la couche interne.
  slideStyle: { type: Object, default: () => ({}) },
  // Scène FIGÉE de la vue (kind, isCloudView, analyseLeft, analyseColumn) : reçue en prop
  // pour que le contenu ET l'ancrage horizontal restent stables quand la scène glisse dehors.
  scene: { type: Object, default: () => ({}) },
})

// Cards (hors nuage) : injectées vivantes (best-effort à la sortie d'un calque à cards).
const { analyseCards, focusedLayer } = inject('maq')

// Gabarit du nuage inline : deux pages de large pour une de haut (≈ ratio d'une double
// page A5).
const CLOUD_DIMS = { width: 1040, height: 740, verticalRatio: 0.25, animateEntry: false }

// Types de mots proposés par le sélecteur : personnages et lieux d'abord, grammaire ensuite.
const CLOUD_CATEGORIES = [
  { key: 'nom', label: 'Noms' },
  { key: 'personne', label: 'Personnages' },
  { key: 'lieu', label: 'Lieux' },
  { key: 'verbe', label: 'Verbes' },
  { key: 'adj', label: 'Adjectifs' },
]
// Type porté par le GRAND nuage, choisi via la rangée de chips.
const mainCategory = ref('nom')

// Mesure du nuage inline (ResizeObserver local à la scène).
const cloudEl = ref(null)
const cloudW = ref(0)
const cloudH = ref(0)
let cloudRo = null
watch(cloudEl, (el) => {
  cloudRo?.disconnect()
  if (!el) { cloudRo = null; return }
  const measure = () => { cloudW.value = el.clientWidth; cloudH.value = el.clientHeight }
  measure()
  cloudRo = new ResizeObserver(measure)
  cloudRo.observe(el)
})
onUnmounted(() => cloudRo?.disconnect())

// Colonne 1/3 des blocs : les cards y TÉLÉPORTENT leur #aside (cf. AnalyseBlock).
const analyseAsideEl = ref(null)
provide('analyseAsideTo', analyseAsideEl)
// La scène a une hauteur BORNÉE : les blocs l'épousent et leurs viz s'y réduisent.
provide('analyseFit', true)
</script>

<style scoped>
/* Clip : borné en bas au-dessus du dock, MAIS remonte jusqu'en haut (top: 0) pour que la
   scène, en glissant vers le haut à la sortie, file SOUS les barres (menu / doc-bar /
   maq-bar) au lieu d'être coupée à leur pied. `z-index: 2` la garde au-dessus de l'iframe
   du folio (z-index 1) — clics des chips OK — et sous doc-bar (99) / maq-bar (170) ; le
   menu, lui, est remonté au-dessus (cf. App .menu). Le CONTENU reste dans la zone folio
   (cf. `.maq-analyse` top). Fixed = calé viewport. */
.maq-analyse-clip {
  position: fixed;
  top: 0;
  bottom: calc(var(--maq-dock-h) + var(--sp-4));
  z-index: 2;
  overflow: hidden;
}

/* Couche interne : le nuage/cards + le glissement (slideStyle). Ferrée dans la ZONE FOLIO
   (sous les barres) au repos ; en glissant elle traverse la bande des barres, qui la
   couvrent. */
.maq-analyse {
  position: absolute;
  top: calc(4em + var(--bar-size));
  left: 0;
  right: 0;
  bottom: 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.maq-analyse__scroll {
  height: 100%;
}

/* Rangée de chips du sélecteur de type, posée en tête de la scène du nuage : racine
   inerte, seuls les chips reprennent le pointeur pour ne pas masquer les mots dessous. */
.maq-cloud-cats {
  position: absolute;
  top: var(--sp-2);
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4em;
  pointer-events: none;
}

.maq-cloud-cats :deep(.base-chip) {
  pointer-events: auto;
}

/* Colonne des asides des cards (hors nuage), ferrée au bord droit. Clip + couche interne
   comme la scène, pour glisser sans recouvrir le menu. */
.maq-analyse-aside-clip {
  position: fixed;
  right: 0;
  top: 0;
  bottom: calc(var(--maq-dock-h) + var(--sp-4));
  max-width: 40%;
  z-index: 3;
  overflow: hidden;
}

.maq-analyse-aside {
  position: absolute;
  top: calc(4em + var(--bar-size));
  left: 0;
  right: 0;
  bottom: 0;
}

/* Boîte d'accueil du Teleport. Respiration et séparateurs viennent de `.split-aside`. */
.maq-analyse-aside__inner {
  padding-block: var(--sp-2);
}

/* Vue pas encore montée : le nom de la section, discrètement. */
.maq-analyse__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 8em;
  margin: 0;
  color: var(--c-muted);
  font-size: var(--fs-sm);
}
</style>
