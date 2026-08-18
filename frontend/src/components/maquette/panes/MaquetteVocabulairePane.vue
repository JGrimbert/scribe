<template>
  <!-- Jalon de tête « titredulivre » (vocabulaire / recherche) : la scène des
       résultats. Le FolioView (persistant, dans le shell) coule les lambeaux en
       page nue ; ce pane pose EN REGARD la vue d'analyse (nuage / cards), sa colonne
       de minis et le pager. Route par défaut : hors URL et hors breadcrumb. -->

  <!-- Pager : la molette au-dessus du folio fait la même chose sans s'annoncer. -->
  <div v-if="searchLayout && resultPageCount > 1" class="maq-pager">
    <button
        type="button" class="maq-pager__btn" aria-label="Résultats précédents"
        :disabled="resultPage === 0" @click="stepResultPage(-1)"
    >
      <i class="pi pi-chevron-left"></i>
    </button>
    <span class="maq-pager__count">{{ resultPage + 1 }} / {{ resultPageCount }}</span>
    <button
        type="button" class="maq-pager__btn" aria-label="Résultats suivants"
        :disabled="resultPage >= resultPageCount - 1" @click="stepResultPage(1)"
    >
      <i class="pi pi-chevron-right"></i>
    </button>
  </div>

  <!-- Vue du calque d'analyse focusé, en regard des résultats. Fondu simple à
       l'entrée (la scène n'existe qu'une fois la scène repaginée). Sur le
       Vocabulaire, elle s'étend jusqu'au bord droit (plus de colonne de minis). -->
  <Transition name="maq-scene-fade">
    <div
        v-if="searchLayout"
        ref="cloudEl"
        class="maq-analyse"
        :style="{ left: analyseLeft, right: isCloudView ? 'var(--sp-4)' : analyseColumn }"
    >
      <!-- Sélecteur du type porté par le grand nuage (remplace la navigation par
           les mini-nuages) : rangée de chips posée sur la scène. -->
      <div v-if="isCloudView" class="maq-cloud-cats">
        <BaseChip
            v-for="cat in CLOUD_CATEGORIES"
            :key="cat.key"
            :active="cat.key === mainCategory"
            @click="mainCategory = cat.key"
        >{{ cat.label }}</BaseChip>
      </div>
      <VocabulaireCloud
          v-if="isCloudView"
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
  </Transition>

  <!-- Colonne 1/3 des blocs d'analyse (hors Vocabulaire) : celle que la planche libère
       en glissant d'un cran. Chaque card y téléporte son `#aside`. Le Vocabulaire n'en
       a plus l'usage (le grand nuage occupe désormais toute la largeur). -->
  <div
      v-if="searchLayout && !isCloudView"
      class="maq-analyse-aside"
      :style="{ width: analyseColumn }"
  >
    <CustomScrollbar>
      <div ref="analyseAsideEl" class="maq-analyse-aside__inner split-aside"></div>
    </CustomScrollbar>
  </div>
</template>

<script setup>
import { ref, watch, provide, inject, onUnmounted } from 'vue'
import VocabulaireCloud from '../../analyse/lexical/VocabulaireCloud.vue'
import BaseChip from '../../ui/atoms/BaseChip.vue'
import CustomScrollbar from '../../ui/atoms/CustomScrollbar.vue'

const {
  searchLayout, resultPage, resultPageCount, stepResultPage,
  analyseLeft, analyseColumn, isCloudView, analyseCards, focusedLayer,
} = inject('maq')

// Gabarit du nuage inline : deux pages de large pour une de haut (≈ ratio d'une
// double page A5), là où le dock lui donnait un bandeau plat.
const CLOUD_DIMS = { width: 1040, height: 740, verticalRatio: 0.25, animateEntry: false }

// Types de mots proposés par le sélecteur : personnages et lieux d'abord (ce qu'on
// cherche dans un roman), grammaire ensuite. Pas d'adverbes (trop peu porteurs).
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

// La colonne 1/3 des blocs ne tient pas dans la scène : les blocs la TÉLÉPORTENT dans
// ce panneau ferré à droite (cf. AnalyseBlock, `analyseAsideTo`). Fourni ICI (et non
// dans le shell) : l'élément et ses cards consommatrices vivent dans ce pane.
const analyseAsideEl = ref(null)
provide('analyseAsideTo', analyseAsideEl)
// La scène a une hauteur BORNÉE : les blocs l'épousent et leurs viz s'y réduisent.
provide('analyseFit', true)
</script>

<style scoped>
/* Vue de la section d'analyse focusée (nuage compris) : EN REGARD de la page de
   résultats, bornée en haut et en bas (au-dessus du dock). `--maq-dock-h` est hérité
   de `.maquette`. Fixed = calé sur le viewport (la pile de barres est comptée). */
.maq-analyse {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  position: fixed;
  top: calc(4em + var(--bar-size));
  bottom: calc(var(--maq-dock-h) + var(--sp-4));
  z-index: 2;
}

.maq-analyse__scroll {
  height: 100%;
}

/* Fondu d'entrée (enter seulement : à la sortie la scène change de source). */
.maq-scene-fade-enter-active {
  transition: opacity 0.22s ease;
}

.maq-scene-fade-enter-from {
  opacity: 0;
}

/* Rangée de chips du sélecteur de type, posée en tête de la scène du nuage (comme le
   pager au pied) : racine inerte, seuls les chips reprennent le pointeur pour ne pas
   masquer les mots du nuage dessous. */
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

/* LA colonne que la planche libère en glissant d'un cran, ferrée au bord droit, large
   d'une période de trame (width posée en inline depuis la géométrie). Sans cadre ni
   fond : elle se pose nue sur la trame. */
.maq-analyse-aside {
  position: fixed;
  right: 0;
  top: calc(4em + var(--bar-size));
  bottom: calc(var(--maq-dock-h) + var(--sp-4));
  max-width: 40%;
  z-index: 3;
}

/* Boîte d'accueil du Teleport. Respiration et séparateurs viennent de `.split-aside`
   (analyse.css) : la colonne se lit comme celle du dashboard. */
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

/* Pager des résultats : discret, au pied de la planche. POSÉ SUR elle (pas dans le
   flux). Racine inerte, seuls les boutons reprennent le pointeur. */
.maq-pager {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding-top: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-muted);
  pointer-events: none;
}

.maq-pager__btn {
  pointer-events: auto;
  display: flex;
  align-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
}

.maq-pager__btn:hover:not(:disabled) {
  color: var(--c-accent-alt);
}

.maq-pager__btn:disabled {
  opacity: var(--op-faint);
  cursor: default;
}

.maq-pager__count {
  font-variant-numeric: tabular-nums;
}
</style>
