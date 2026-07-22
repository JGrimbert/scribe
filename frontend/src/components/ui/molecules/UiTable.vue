<template>
  <div
      ref="boxEl"
      class="ui-table-box"
      :class="{ 'ui-table-box--flat': flat, 'ui-table-box--scroll': scroll }"
  >
    <CustomScrollbar
        v-if="scroll"
        ref="scrollbarRef"
        class="ui-table-scroll"
        :top-offset="headOffset"
    >
      <table class="ui-table">
        <slot />
      </table>
    </CustomScrollbar>
    <div v-else class="ui-table-scroll">
      <table class="ui-table">
        <slot />
      </table>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import CustomScrollbar from '../atoms/CustomScrollbar.vue'

const props = defineProps({
  // Défilement interne — usage exceptionnel (listes non tronquables) :
  // partout ailleurs, tronquer plutôt que scroller. Quand actif, la scrollbar
  // native cède la place à CustomScrollbar (règle DS : pas de barre native).
  scroll: { type: Boolean, default: false },
  // Retire le cadre encadré (border stats + anneau floralwhite + header cyan) :
  // à poser quand la table vit déjà dans une UiCard, sinon cadre-dans-cadre et
  // un header teinté qui jure avec le flux de la card.
  flat: { type: Boolean, default: false },
})

// La track de CustomScrollbar ne doit courir que sur le corps : on décale son
// départ de la hauteur du thead (sticky), sinon elle chevauche l'en-tête. Le
// contenu, lui, continue de défiler dessous (cf. prop `topOffset`).
const boxEl = ref(null)
const scrollbarRef = ref(null)
const headOffset = ref(0)
let headRo = null

function syncHead() {
  const thead = boxEl.value?.querySelector('thead')
  const h = thead ? thead.offsetHeight : 0
  if (h === headOffset.value) return
  headOffset.value = h
  // La track ne se recalcule pas au seul changement de prop : forcer la mesure
  // une fois le nouvel offset propagé.
  nextTick(() => scrollbarRef.value?.measure?.())
}

onMounted(() => {
  if (!props.scroll) return
  syncHead()
  const thead = boxEl.value?.querySelector('thead')
  if (thead) {
    headRo = new ResizeObserver(syncHead)
    headRo.observe(thead)
  }
})

onBeforeUnmount(() => headRo?.disconnect())
</script>

<style scoped lang="scss">
/* Cadre externe façon `stats-banner` (AnalyseView) : anneau floralwhite en
   padding, cerné d'une bordure, ET la table intérieure porte SA propre bordure
   — double trait, comme les tuiles StatItem dans leur bandeau. Chrome StatItem
   pour le relief (radius, ombre, backdrop). overflow:hidden clippe les angles. */
.ui-table-box {
  /*margin-top: var(--sp-2);*/
  padding: 0.6em;
  background: var(--c-table-ring);
  backdrop-filter: var(--c-backdrop-filter-blur);
  border: 1px solid var(--c-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-radius: 6px;
  overflow: hidden;
}

/* Table déjà encadrée par un parent (UiCard) : on retombe sur une table nue. */
.ui-table-box--flat {
  padding: 0;
  background: none;
  backdrop-filter: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

/* La bordure « supplémentaire » sur la table elle-même. */
.ui-table-scroll {
  background: var(--c-paper);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.ui-table-box--flat .ui-table-scroll {
  background: none;
  border: 0;
  border-radius: 0;
}

/* CustomScrollbar est height:100% par défaut (attend un parent à hauteur
   définie) ; ici on borne plutôt son contenu et on le laisse défiler seul. */
.ui-table-box--scroll :deep(.custom-scrollbar),
.ui-table-box--scroll :deep(.custom-scrollbar__content) {
  height: auto;
  max-height: 24em;
}

.ui-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-md);
  background: var(--c-paper);
}

/* le contenu (thead/tbody) vient du slot → :deep obligatoire */
.ui-table :deep(th),
.ui-table :deep(td) {
  text-align: left;
  padding: 0.55em 0.8em;
  border-bottom: 1px solid var(--c-border);
}

/* Le filet sous l'en-tête est un box-shadow inset, PAS un border-bottom : avec
   border-collapse, la bordure appartient à la grille de la table et défile avec
   le corps quand le thead est sticky. Le box-shadow, lui, reste attaché à la
   cellule sticky. */
.ui-table :deep(thead th) {
  font-weight: 600;
  color: var(--c-ink);
  border-bottom: 0;
  box-shadow: inset 0 -1px 0 var(--c-border);
}

.ui-table :deep(thead th:first-child) {
  border-top-left-radius: var(--radius-md);
}

.ui-table :deep(thead th:last-child) {
  border-top-right-radius: var(--radius-md);
}

/* En-tête cyan RÉSERVÉ aux tables encadrées (config). Les tables `flat`
   (analyse) l'abandonnent : un bandeau teinté jurait dans le flux d'une card.
   Fond translucide + blur : au défilement, le corps passe sous l'en-tête en
   flou, comme sous la doc-bar. Encre = le bleu du fil d'Ariane. */
.ui-table-box:not(.ui-table-box--flat) .ui-table :deep(thead th) {
  color: var(--c-table-head-ink);
  background: var(--c-table-head-bg);
  box-shadow: inset 0 -1px 0 var(--c-table-head-border);
  backdrop-filter: blur(4px);
}

.ui-table-box--scroll .ui-table :deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 1;
}

/* Flat + sticky : pas de blur ni de cyan à révéler, l'en-tête reste opaque
   (papier) pour masquer proprement les lignes qui défilent. */
.ui-table-box--scroll.ui-table-box--flat .ui-table :deep(thead th) {
  background: var(--c-paper);
}

/* Dernière ligne : pas de filet, le cadre ferme déjà la table. */
.ui-table :deep(tbody tr:last-child td) {
  border-bottom: 0;
}

.ui-table :deep(.num) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.ui-table :deep(.row-link) {
  cursor: pointer;
}

/* Survol léger sur toutes les lignes du corps. */
.ui-table :deep(tbody tr:hover) {
  background: var(--c-table-row-hover);
}

/* Quand la track verticale est RÉELLEMENT présente (débordement → v-if de
   CustomScrollbar), elle recouvre le bord droit du contenu : on éloigne la
   dernière cellule de 12px (l'épaisseur de la track). Appliqué au th ET au td
   de fin, sinon une colonne .num (alignée à droite) désaligne header et corps. */
.ui-table-box--scroll :deep(.custom-scrollbar:has(.custom-scrollbar__track--y) tr > :last-child) {
  padding-right: calc(0.8em + 12px);
}
</style>
