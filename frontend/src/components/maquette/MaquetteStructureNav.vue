<template>
  <!-- Sommaire flottant de l'écran Maquette : toujours ouvert, hors flux (il ne
       pousse pas la maquette). De haut en bas : le CHAMP DE RECHERCHE (descendu
       ici depuis la doc-bar — en maquette, la recherche appartient au sommaire),
       en rangée nue ; puis la carte, qui porte les PARTIES (Format · Liminaire ·
       Chapitrage n°x, = les `series` de l'accordéon) et l'arbre des axes
       (StructureView réutilisé). Le focus du champ étend la carte vers la droite
       et remplace le seul arbre par le panneau (stats + résultats/nuage) : la
       liste des parties, elle, reste toujours visible. -->
  <div ref="rootEl" class="maq-nav" >
    <!-- Rangée de recherche NUE (hors carte) : elle pousse le sommaire vers le
         bas au lieu de partager son cadre. Loupe teal, champ sans bord ni fond. -->
    <label class="maq-search">
      <i class="pi pi-search maq-search__icon"></i>
      <input
          ref="inputEl"
          v-model="query"
          type="search"
          class="maq-search__input"
          placeholder="Rechercher…"
          @focus="open = true"
      />
    </label>

    <!-- La carte : le sommaire, ou — pendant la recherche — le panneau (stats,
         onglets Résultats/Nuage) qui prend toute sa place. -->
    <div class="maq-nav__card">
      <!-- Liste d'exploration (Format · Liminaire · Chapitrage n°x) : TOUJOURS
           visible — la recherche ne prend la place que de l'arbre des axes. -->
      <div class="maq-nav__parts">
        <TreeRow
            v-for="part in parts"
            :key="part.key"
            variant="list"
            normalize-case
            :current="part.key === activeSeriesKey"
            @open="$emit('focus-series', part.key)"
        >
          {{ part.label }}
        </TreeRow>
      </div>
      <div class="maq-nav__scroll">
        <StructureView
            v-if="trame && data"
            :trame="trame"
            :data="data"
            :node-id="nodeId"
            :expanded="true"
            @select="$emit('select-node', $event)"
        />
      </div>

<!--      <DocSearchPanel
          class="maq-nav__panel"
          :width="panelWidth"
          :query="query"
          @select-node="$emit('select-node', $event)"
      />-->
    </div>

    <!-- Pied de la colonne : le dock accordéon de la maquette. Il vit ICI pour
         être ferré au bord gauche de la fenêtre (le sommaire l'est déjà) et
         déborde volontairement la largeur du sommaire — d'où sa largeur propre. -->
    <div ref="footerEl" class="maq-nav__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import StructureView from '../structure/StructureView.vue'
import TreeRow from '../ui/molecules/TreeRow.vue'
import DocSearchPanel from '../layout/DocSearchPanel.vue'

defineProps({
  // Parties de l'écran (Format · Liminaire · Chapitrage n°x) : { key, label }.
  parts: { type: Array, default: () => [] },
  // Série du cran focusé — surligne la partie correspondante.
  activeSeriesKey: { type: String, default: null },
  trame: { type: Object, default: null },
  data: { type: Object, default: null },
  // Nœud témoin courant de l'aperçu (surligne son axe dans l'arbre).
  nodeId: { type: String, default: null },
})

// `update:searching` : la maquette replie son accordéon tant que la recherche est
// ouverte, et le rend tel quel à la fermeture. `update:query` : elle en fait ses
// résultats (le module qui remplace l'aperçu).
const emit = defineEmits(['focus-series', 'select-node', 'update:searching', 'update:query'])

const query = ref('')
watch(query, (q) => emit('update:query', q))

// ── Volet de recherche : il vit DANS la carte, qui s'étend ───────────────────
const open = ref(false)
const rootEl = ref(null)
const footerEl = ref(null)
const inputEl = ref(null)
// Largeur du panneau (px) — pilote le nombre de mots par défaut du nuage.
const panelWidth = ref(0)

// Fermeture : Échap, ou clic hors de la carte (le panneau étant DANS la carte,
// un seul conteneur à tester — pas de blur à surveiller, contrairement au volet
// téléporté de la doc-bar).
function onDocKeydown(e) {
  if (e.key === 'Escape') { open.value = false; inputEl.value?.blur() }
}
// Le dock est DANS la colonne mais n'appartient pas au volet de recherche : y
// cliquer (choisir un cran) doit refermer la recherche comme un clic dehors.
function onDocMousedown(e) {
  if (e.button !== 0) return
  if (rootEl.value?.contains(e.target) && !footerEl.value?.contains(e.target)) return
  open.value = false
}

watch(open, (isOpen) => {
  emit('update:searching', isOpen)
  if (isOpen) {
    nextTick(() => {
      panelWidth.value = rootEl.value?.querySelector('.maq-nav__panel')?.clientWidth ?? 0
    })
  }
  const m = isOpen ? 'addEventListener' : 'removeEventListener'
  document[m]('keydown', onDocKeydown)
  document[m]('mousedown', onDocMousedown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onDocKeydown)
  document.removeEventListener('mousedown', onDocMousedown)
})
</script>

<style scoped>
/* Colonne flottante hors flux, calée sous la doc-bar : rangée de recherche NUE
   en tête, carte du sommaire dessous. Le conteneur n'a aucun décor propre —
   `pointer-events:none` dessus, `auto` sur ses zones utiles, pour laisser passer
   les clics autour. */
.maq-nav {
  position: absolute;
  top:calc(var(--bar-size) + 1.1em);
  left: 0;
  width: 15em;
  /* Hauteur PLEINE (et non `max-height`) : le pied doit pouvoir se caler en bas
     de la colonne, le sommaire restant en tête. */
  height: calc(100% - var(--bar-size) - 1.25em - var(--sp-4));
  display: flex;

  flex-direction: column;
  /* L'espace sous la rangée de recherche n'est PAS le gap commun : il est réglé
     pour que le filet de tête de la planche (trame de fond, cf. FolioView) tombe
     au milieu entre « Rechercher » et le premier item du sommaire. Il est donc
     porté par la carte seule (--maq-search-space), pas par ce gap — à réajuster
     si la hauteur du champ ou celle des TreeRow change. */
  --maq-search-space: 0.875rem;
  gap: 0;
  /* Au-dessus du reste de la maquette, sous les modales (z 200). */
  z-index: 160;
  pointer-events: none;
  transition: width 0.18s ease;

  margin: 0 1em;
}

/* Recherche ouverte : la carte s'étend vers la droite et sur toute la hauteur
   disponible. Le sommaire cède la place au panneau — jamais deux contenus côte
   à côte. */
.maq-nav--search {
  width: min(38em, calc(100% - var(--sp-4)));
  height: calc(100% - var(--bar-size) - 1.25em - var(--sp-4));
  /* Étendue, la carte est un panneau : elle capte les clics au lieu de les
     laisser filer vers le folio (au repos, au contraire, elle les laisse
     passer — elle n'est qu'un sommaire posé par-dessus). */
  pointer-events: auto;
}

/* Carte flottante (mêmes traits que les contrôles liminaire et les blocs de
   l'aside). Au repos, sa taille s'ajuste au contenu : l'espace vide ne couvre
   pas le folio. */
.maq-nav__card {
  margin-top: 1.6em;
  min-height: 0;
  display: flex;
  /* Colonne : parties en tête (permanentes), puis l'arbre — ou le panneau de
     recherche à sa place. */
  flex-direction: column;
  gap: var(--sp-2);
  /* Le padding HAUT porte à lui seul l'espace sous le champ de recherche (cf.
     --maq-search-space) : le filet de tête tombe dedans, à mi-chemin. */
  padding: var(--maq-search-space) var(--sp-3) var(--sp-3);
 /* border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-card-float);*/
  backdrop-filter: var(--c-backdrop-filter-blur);
}

.maq-nav--search .maq-nav__card {
  flex: 1 1 auto;
}

/* Pied de colonne (dock accordéon) : poussé en bas (`margin-top: auto`), FERRÉ AU
   BORD GAUCHE de la fenêtre — la marge latérale de la colonne est annulée — et
   plus large qu'elle : la pellicule a besoin de la largeur de la zone principale,
   pas des 15em du sommaire. */
.maq-nav__footer {
  margin-top: auto;
  margin-left: -1em;
  width: 66vw;
  pointer-events: auto;
}

/* Rangée de recherche : hors carte, sans cadre ni fond — juste la loupe et le
   champ posés sur la maquette. */
.maq-search {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 1em;
  padding: 0 var(--fs-lg);
  pointer-events: auto;
}

/* Loupe teal, plus présente que le champ : PrimeIcons est une police d'icônes,
   `font-weight` n'y fait rien — l'épaisseur vient du contour. */
.maq-search__icon {
  flex: 0 0 auto;
  font-size: 1.15em;
  color: var(--c-accent-alt-darker);
  -webkit-text-stroke: 0.6px currentColor;
}

.maq-search__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
}

.maq-search__input:focus {
  outline: none;
}

.maq-search__input::placeholder {
  color: inherit;
  opacity: var(--op-faint);
}

.maq-search__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

/* Arbre des axes : défile sans barre visible (scrollbar masquée) — pas de chrome. */
.maq-nav__scroll {
  pointer-events: auto;
  flex: 0 1 auto;
  width: 100%;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.maq-nav__scroll::-webkit-scrollbar {
  display: none;
}

/* Sous les parties pendant la recherche (l'arbre, lui, est démonté). `min-height`
   + `overflow` : le nuage est un SVG en `overflow: visible` dont les mots peuvent
   déborder de leur boîte — sans clip ici, ils iraient mordre sur la liste. */
.maq-nav__panel {
  pointer-events: auto;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Positionnée : elle passe devant tout contenu du panneau qui déborderait. */
.maq-nav__parts {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  pointer-events: auto;
  padding: 0 0.6em;
}

/* StructureView est pensé pour la colonne d'aside (fond + décrochement sous la
   barre) ; ici il flotte, sans fond ni décrochement. La classe de scope de
   StructureView est posée SUR `.structure-panel`, d'où le ciblage direct. */
.maq-nav__scroll :deep(.structure-panel) {
  margin-top: 0;
  background: transparent;
}
</style>
