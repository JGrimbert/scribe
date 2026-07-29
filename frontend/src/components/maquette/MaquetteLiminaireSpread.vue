<template>
  <!-- Vis-à-vis liminaire HYBRIDE (main) : l'ossature d'imposition (couverture,
       pages blanches, blanche implicite) reste schématique via LiminaireFolio ;
       les pages de CONTENU sont rendues en vrai Paged.js (FolioView, mode read),
       alimentées par un nœud synthétique bâti des entrées de la page. Au plus
       2 iframes Paged.js, uniquement pour la planche focusée (cf. mémoire perf). -->
  <div class="lim-spread" :style="{ '--maq-ratio': ratio }">
    <div
        v-for="(cell, ci) in [spread && spread.left, spread && spread.right]"
        :key="ci"
        class="lim-page"
        :class="ci === 0 ? 'is-left' : 'is-right'"
    >
      <FolioView
          v-if="isContent(cell)"
          class="lim-page__folio"
          mode="read"
          :data="nodeDataFor(cell)"
          :node-id="cell.page.key"
          :depth="0"
          :visuals="visuals"
          :page="page"
          :margins="margins"
          :hyphenation="hyphenation"
          :running-titles="runningTitles"
          :book-title="bookTitle"
      />
      <LiminaireFolio v-else :cell="cell" :type="typeOf(cell)" :suggestion="suggestionOf(cell)" />
    </div>
  </div>
</template>

<script setup>
import FolioView from '../editor/FolioView.vue'
import LiminaireFolio from '../liminaire/LiminaireFolio.vue'

const props = defineProps({
  // La planche focusée : { left, right } (slots d'imposition, cf. toSpreads).
  spread: { type: Object, default: null },
  // Verdict des cellules schématiques (LiminaireFolio).
  types: { type: Object, default: () => ({}) },
  suggestions: { type: Object, default: () => ({}) },
  // Rendu Paged.js des pages de contenu (mêmes props que l'aperçu de config).
  visuals: { type: Object, default: null },
  page: { type: Object, default: null },
  margins: { type: Object, default: null },
  hyphenation: { type: Object, default: null },
  runningTitles: { type: Object, default: null },
  bookTitle: { type: String, default: '' },
  // Ratio largeur/hauteur de la page effective (pour caler les cellules schéma).
  ratio: { type: Number, default: 148 / 210 },
})

// Une cellule de contenu = une page réelle du .odt, ni couverture ni blanche.
function isContent(cell) {
  return !!(cell && cell.page && !cell.blank && !cell.cover)
}

// Nœud synthétique pour FolioView : les entrées de la page en `texte`, sans titre
// (buildBlocks ajoute néanmoins un <h1> vide en tête — artefact mineur, à raffiner).
function nodeDataFor(cell) {
  return { [cell.page.key]: { texte: cell.page.entries ?? [], titre: '' } }
}

function typeOf(cell) {
  return cell?.page ? (props.types[cell.page.key] ?? '') : ''
}
function suggestionOf(cell) {
  return cell?.page ? (props.suggestions[cell.page.key] ?? null) : null
}
</script>

<style scoped>
.lim-spread {
  display: flex;
  gap: 2px;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  max-width: 46em;
}

.lim-page {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
}

.lim-page__folio {
  width: 100%;
}

/* La reliure : bord intérieur plus marqué (verso à droite, recto à gauche). */
.is-left :deep(.folio) { border-right-width: 2px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.is-right :deep(.folio) { border-left-width: 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; }

/* Cellules schématiques calées sur le ratio de la page effective (pour s'aligner
   en hauteur avec les pages de contenu rendues à côté). */
.lim-page :deep(.folio) {
  width: 100%;
  max-width: none;
  aspect-ratio: var(--maq-ratio, 0.7);
}
</style>
