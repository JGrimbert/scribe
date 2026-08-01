<template>
  <!-- Sommaire flottant de l'écran Maquette : toujours ouvert, hors flux (il ne
       pousse pas la maquette). Carte flottante portant, de haut en bas, le CHAMP
       DE RECHERCHE (descendu ici depuis la doc-bar : en maquette, recherche et
       sommaire sont UN SEUL module, un seul cadre), puis les PARTIES (Format ·
       Liminaire · Chapitrage n°x, = les `series` de l'accordéon) et l'arbre des
       axes (StructureView réutilisé). Le focus du champ étend la carte vers la
       droite pour englober le panneau (stats + nuage). -->
  <div ref="rootEl" class="maq-nav" :class="{ 'maq-nav--search': open }">
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

    <div class="maq-nav__body">
      <div class="maq-nav__scroll">
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

        <StructureView
            v-if="trame && data"
            :trame="trame"
            :data="data"
            :node-id="nodeId"
            :expanded="true"
            @select="$emit('select-node', $event)"
        />
      </div>

      <DocSearchPanel v-if="open" class="maq-nav__panel" :width="panelWidth" />
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

defineEmits(['focus-series', 'select-node'])

// Saisie retenue localement, pas encore branchée sur une recherche (même état
// que le champ de la doc-bar sur les autres écrans).
const query = ref('')

// ── Volet de recherche : il vit DANS la carte, qui s'étend ───────────────────
const open = ref(false)
const rootEl = ref(null)
const inputEl = ref(null)
// Largeur du panneau (px) — pilote le nombre de mots par défaut du nuage.
const panelWidth = ref(0)

// Fermeture : Échap, ou clic hors de la carte (le panneau étant DANS la carte,
// un seul conteneur à tester — pas de blur à surveiller, contrairement au volet
// téléporté de la doc-bar).
function onDocKeydown(e) {
  if (e.key === 'Escape') { open.value = false; inputEl.value?.blur() }
}
function onDocMousedown(e) {
  if (e.button !== 0) return
  if (rootEl.value?.contains(e.target)) return
  open.value = false
}

watch(open, (isOpen) => {
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
/* Hors flux, calé sous la doc-bar. Carte flottante (mêmes traits que les
   contrôles liminaire et les blocs de l'aside). Au repos, sa taille s'ajuste au
   contenu (bornée par max-height) : l'espace vide ne couvre pas le folio.
   `pointer-events:none` sur le conteneur, `auto` sur ses zones utiles, pour
   laisser passer les clics autour. */
.maq-nav {
  position: absolute;
  top: calc(var(--bar-size) + 1.25em);
  left: 0;
  width: 15em;
  max-height: calc(100% - var(--bar-size) - 1.25em - var(--sp-4));
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  /* Au-dessus du reste de la maquette, sous les modales (z 200). */
  z-index: 160;
  pointer-events: none;
  padding: var(--sp-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-card-float);
  backdrop-filter: var(--c-backdrop-filter-blur);
  transition: width 0.18s ease;

  margin: 0 1em;
}

/* Recherche ouverte : la MÊME carte s'étend vers la droite (et sur toute la
   hauteur disponible) pour englober le panneau — un seul cadre, pas un volet
   accolé. Le sommaire, lui, ne bouge pas : il garde sa largeur à gauche. */
.maq-nav--search {
  width: min(78em, calc(100% - var(--sp-4)));
  height: calc(100% - var(--bar-size) - 1.25em - var(--sp-4));
  /* Étendue, la carte est un panneau : elle capte les clics au lieu de les
     laisser filer vers le folio (au repos, au contraire, elle les laisse
     passer — elle n'est qu'un sommaire posé par-dessus). */
  pointer-events: auto;
}

/* Champ de recherche : discret dans la carte (filet bas seulement), pleine
   largeur, loupe à gauche. */
.maq-search {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.4em;
  padding-bottom: var(--sp-2);
  border-bottom: 1px solid var(--c-border);
  pointer-events: auto;
}

.maq-search__icon {
  flex: 0 0 auto;
  font-size: 0.9em;
  opacity: var(--op-muted);
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

/* Corps de la carte : sommaire à gauche (largeur fixe), panneau à droite quand
   la recherche est ouverte. */
.maq-nav__body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
  gap: var(--sp-3);
}

/* Défile sans barre visible (scrollbar masquée) — pas de chrome. */
.maq-nav__scroll {
  pointer-events: auto;
  flex: 0 0 auto;
  width: 100%;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.maq-nav--search .maq-nav__scroll {
  width: 14em;
}

.maq-nav__scroll::-webkit-scrollbar {
  display: none;
}

.maq-nav__panel {
  pointer-events: auto;
  /*border-left: 1px solid var(--c-border);*/
  padding-left: var(--sp-3);
}

.maq-nav__parts {
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
