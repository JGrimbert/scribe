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
       l'entrée (la scène n'existe qu'une fois la scène repaginée). -->
  <Transition name="maq-scene-fade">
    <div
        v-if="searchLayout"
        ref="cloudEl"
        class="maq-analyse"
        :style="{ left: analyseLeft, right: analyseColumn }"
    >
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

  <!-- Colonne 1/3 des blocs d'analyse : celle que la planche libère en glissant d'un
       cran. Chaque card y téléporte son `#aside` ; sur le Vocabulaire elle empile les
       mini-nuages des types que le grand nuage ne montre pas. -->
  <div
      v-if="searchLayout"
      class="maq-analyse-aside"
      :class="{ 'maq-analyse-aside--minis': isCloudView }"
      :style="{ width: analyseColumn }"
  >
    <CustomScrollbar>
      <div ref="analyseAsideEl" class="maq-analyse-aside__inner split-aside">
        <div v-if="isCloudView" class="maq-minis">
          <MiniCloud
              v-for="mini in miniClouds"
              :key="mini.key"
              :category="mini.key"
              :label="mini.label"
              @activate="mainCategory = mini.key"
          />
        </div>
      </div>
    </CustomScrollbar>
  </div>
</template>

<script setup>
import { ref, computed, watch, provide, inject, onUnmounted } from 'vue'
import VocabulaireCloud from '../../analyse/lexical/VocabulaireCloud.vue'
import MiniCloud from '../../analyse/lexical/MiniCloud.vue'
import CustomScrollbar from '../../ui/atoms/CustomScrollbar.vue'

const {
  searchLayout, resultPage, resultPageCount, stepResultPage,
  analyseLeft, analyseColumn, isCloudView, analyseCards, focusedLayer,
} = inject('maq')

// Gabarit du nuage inline : deux pages de large pour une de haut (≈ ratio d'une
// double page A5), là où le dock lui donnait un bandeau plat.
const CLOUD_DIMS = { width: 1040, height: 740, verticalRatio: 0.25, animateEntry: false }

// Types de mots, dans l'ordre de la colonne : personnages et lieux d'abord (ce
// qu'on cherche dans un roman), grammaire ensuite. Pas d'adverbes (trop peu porteurs).
const CLOUD_CATEGORIES = [
  { key: 'nom', label: 'Noms' },
  { key: 'personne', label: 'Personnages' },
  { key: 'lieu', label: 'Lieux' },
  { key: 'verbe', label: 'Verbes' },
  { key: 'adj', label: 'Adjectifs' },
]
// Type porté par le GRAND nuage. Les autres restent en minis : promouvoir un mini le
// retire de la liste, celui qu'il remplace y revient à sa place (l'ordre ne bouge pas).
const mainCategory = ref('nom')
const miniClouds = computed(() => CLOUD_CATEGORIES.filter((c) => c.key !== mainCategory.value))

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

/* LA colonne que la planche libère en glissant d'un cran, ferrée au bord droit, large
   d'une période de trame (width posée en inline depuis la géométrie). Sans cadre ni
   fond : elle se pose nue sur la trame, comme les mini-nuages qu'elle porte. */
.maq-analyse-aside {
  position: fixed;
  right: 0;
  top: calc(4em + var(--bar-size));
  bottom: calc(var(--maq-dock-h) + var(--sp-4));
  max-width: 40%;
  z-index: 3;
}

/* Les trois mini-nuages en tête de colonne : un seul écart entre eux et le séparateur
   de `.split-aside`. La respiration est celle des cards (`--split-pad-aside`). */
.maq-minis {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--split-pad-aside);
}

/* Vue Vocabulaire : les mini-nuages SEULS remplissent la colonne jusqu'en bas
   (pas de scroll, aucune card en dessous). */
.maq-analyse-aside--minis {
  bottom: var(--sp-4);
}

.maq-analyse-aside--minis :deep(.custom-scrollbar__content) {
  overflow: hidden;
}

.maq-analyse-aside--minis .maq-analyse-aside__inner {
  height: 100%;
}

.maq-analyse-aside--minis .maq-minis {
  height: 100%;
  justify-content: space-evenly;
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
