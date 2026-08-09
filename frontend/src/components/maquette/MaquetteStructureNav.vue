<template>
  <!-- Sommaire flottant de l'écran Maquette : toujours ouvert, hors flux (il ne
       pousse pas la maquette). Il porte les PARTIES (Format · Liminaire ·
       Chapitrage · Annotations, = les `series` de l'accordéon, groupées) — chacune
       dépliable pour montrer son contenu — puis la partie « Contenu » (l'arbre des
       axes, StructureView réutilisé). Tout défile dans UNE seule zone : la surface
       se prolonge SOUS le dock accordéon, qui la masque en pied. Le champ de
       recherche vit dans la troisième barre (MaquetteBar), pas ici. -->
  <div class="maq-nav">
    <div class="maq-nav__card">
      <div class="maq-nav__scroll">
        <!-- Deux têtes de premier niveau, mutuellement exclusives (cf. `topOpen`) :
             « Maquette » englobe toutes les parties de l'accordéon ; « Table des
             matières » porte l'arbre des axes. Ouvrir l'une ferme l'autre. -->
        <div class="maq-nav__parts">
          <TreeRow
              columns
              variant="list"
              normalize-case
              expandable
              leading-icon="pi-book"
              :expanded="topOpen === 'maquette'"
              @open="toggleTop('maquette')"
              @toggle="toggleTop('maquette')"
          >
            Maquette
          </TreeRow>
          <div v-if="topOpen === 'maquette'" class="maq-nav__sub">
            <template v-for="g in groups" :key="g.key">
              <!-- Feuilles simples : Format · Annotations. -->
              <TreeRow
                  v-if="g.kind === 'leaf' || g.kind === 'annotations'"
                  columns
                  variant="list"
                  normalize-case
                  :current="g.key === activeSeriesKey"
                  @open="$emit('focus-series', g.key)"
              >
                {{ g.label }}
              </TreeRow>

              <!-- Liminaire : dossier dépliable → une ligne par page avec select de type. -->
              <template v-else-if="g.kind === 'liminaire'">
                <TreeRow
                    columns
                    variant="list"
                    normalize-case
                    expandable
                    leading-icon="pi-folder"
                    :expanded="isOpen(g.key)"
                    :current="g.key === activeSeriesKey"
                    @open="$emit('focus-series', g.key)"
                    @toggle="toggle(g.key)"
                >
                  {{ g.label }}
                </TreeRow>
                <div v-if="isOpen(g.key)" class="maq-nav__sub">
                  <div v-for="pg in limPageRows" :key="pg.key" class="maq-nav__lim-page">
                    <span class="maq-nav__lim-num" :title="pg.preview">{{ pg.label }}</span>
                    <BaseSelect
                        class="maq-nav__lim-select"
                        :class="{ 'has-suggestion': !limTypes[pg.key] && limSuggestions[pg.key] }"
                        :title="limSuggestions[pg.key] ? limSuggestions[pg.key].why : ''"
                        :model-value="limTypes[pg.key] || ''"
                        @update:model-value="$emit('set-lim-type', pg.page, $event)"
                    >
                      <option value="">
                        {{ limSuggestions[pg.key] ? `⚡ ${labelOf(limSuggestions[pg.key].key)} ?` : '— type —' }}
                      </option>
                      <option v-for="t in LIMINAIRE_PAGES" :key="t.key" :value="t.key">{{ t.label }}</option>
                    </BaseSelect>
                  </div>
                  <p v-if="!limPageRows.length" class="maq-nav__empty">Aucune page liminaire.</p>
                </div>
              </template>

              <!-- Chapitrage : dossier dépliable → une page par niveau (« Chapitrage n°x »). -->
              <template v-else-if="g.kind === 'chapitrage'">
                <TreeRow
                    columns
                    variant="list"
                    normalize-case
                    expandable
                    leading-icon="pi-folder"
                    :expanded="isOpen(g.key)"
                    @open="toggle(g.key)"
                    @toggle="toggle(g.key)"
                >
                  {{ g.label }}
                </TreeRow>
                <div v-if="isOpen(g.key)" class="maq-nav__sub">
                  <TreeRow
                      v-for="lv in g.levels"
                      :key="lv.key"
                      columns
                      variant="list"
                      normalize-case
                      :current="lv.key === activeSeriesKey"
                      @open="$emit('focus-series', lv.key)"
                  >
                    {{ lv.label }}
                  </TreeRow>
                </div>
              </template>
            </template>
          </div>

          <!-- Table des matières : dépliable → l'arbre des axes (StructureView, laissé
               tel quel). Fermée quand « Maquette » est ouverte, indépendante de la
               progression au centre. -->
          <TreeRow
              columns
              variant="list"
              normalize-case
              expandable
              leading-icon="pi-list"
              :expanded="topOpen === 'toc'"
              @open="toggleTop('toc')"
              @toggle="toggleTop('toc')"
          >
            Table des matières
          </TreeRow>
          <div v-if="topOpen === 'toc'" class="maq-nav__toc">
            <StructureView
                v-if="trame && data"
                :trame="trame"
                :data="data"
                :node-id="nodeId"
                :expanded="true"
                @select="$emit('select-node', $event)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Pied de la colonne : le dock accordéon de la maquette. Hors flux (overlay
         ferré au bord gauche/bas) — il ne réserve plus de hauteur, la surface de
         contenu passe DESSOUS et il la masque. Il déborde volontairement la largeur
         du sommaire, d'où sa largeur propre. -->
    <div class="maq-nav__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import StructureView from '../structure/StructureView.vue'
import TreeRow from '../ui/molecules/TreeRow.vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY } from '../../script/liminaire-vocab'

const props = defineProps({
  // Parties de l'écran, groupées : { key, label, kind } où kind ∈
  // 'leaf' | 'liminaire' | 'chapitrage' | 'annotations'. Le chapitrage porte
  // `levels: [{ key, label }]` (une page par niveau).
  groups: { type: Array, default: () => [] },
  // Série du cran focusé — surligne la partie correspondante.
  activeSeriesKey: { type: String, default: null },
  trame: { type: Object, default: null },
  data: { type: Object, default: null },
  // Nœud témoin courant de l'aperçu (surligne son axe dans l'arbre et son titre).
  nodeId: { type: String, default: null },
  // Pages liminaires (mêmes objets que ceux typés dans LiminaireControls).
  liminairePages: { type: Array, default: () => [] },
  limTypes: { type: Object, default: () => ({}) },
  limSuggestions: { type: Object, default: () => ({}) },
})

defineEmits(['focus-series', 'select-node', 'set-lim-type'])

// Dépli piloté par la PROGRESSION au centre (accordéon) : seul le jalon focusé est
// ouvert, les autres restent fermés (ne sont pas déclenchés). Le chevron permet un
// pli manuel ponctuel, réinitialisé au changement de jalon.
const open = reactive(new Set())
const isOpen = (key) => open.has(key)
function toggle(key) {
  if (open.has(key)) open.delete(key)
  else open.add(key)
}

// Tête de premier niveau ouverte : 'maquette' | 'toc' | null. Mutuellement
// exclusives — ouvrir l'une ferme l'autre. « Maquette » ouverte au démarrage.
const topOpen = ref('maquette')
function toggleTop(key) {
  topOpen.value = topOpen.value === key ? null : key
}

watch(
  () => props.activeSeriesKey,
  (key) => {
    open.clear()
    // Un niveau focusé (chap-N) ouvre son dossier parent « Chapitrage ».
    if (key?.startsWith('chap-')) open.add('chapitrage')
    else if (key) open.add(key)
    // Focuser un cran, c'est travailler dans la maquette : on l'ouvre (et donc on
    // ferme la table des matières, exclusion mutuelle).
    if (key) topOpen.value = 'maquette'
  },
  { immediate: true },
)

// Pages taguables : on écarte les blanches (rien à typer), comme LiminaireControls.
const limPageRows = computed(() =>
  props.liminairePages
    .filter((p) => !p.isBlank)
    .map((p) => ({ key: p.key, page: p, label: `Page ${p.ordinal + 1}`, preview: p.preview })),
)

const labelOf = (key) => LIMINAIRE_BY_KEY.get(key)?.label ?? key
</script>

<style scoped>
/* Colonne flottante hors flux, calée sous les DEUX barres (doc-bar + barre de la
   maquette, cf. MaquetteBar) : la carte du sommaire occupe TOUTE la hauteur, le dock
   se pose en pied par-dessus. Le conteneur n'a aucun décor propre — `pointer-events:
   none` dessus, `auto` sur ses zones utiles, pour laisser passer les clics autour. */
.maq-nav {
  position: absolute;
  top: calc(1.3 * var(--bar-size));
  left: 0;
  width: 15em;
  height: calc(100% - 2 * var(--bar-size) - var(--sp-4) / 2);
  display: flex;
  flex-direction: column;
  z-index: 160;
  pointer-events: none;
}

/* Carte flottante (mêmes traits que les contrôles liminaire et les blocs de
   l'aside). Pleine hauteur : sa zone de défilement se prolonge sous le dock. */
.maq-nav__card {
  margin-top: 1.1em;
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  padding: var(--sp-3);
  backdrop-filter: var(--c-backdrop-filter-blur);
}

/* UNE seule zone de défilement (parties + contenu) — pas de scrollbars imbriquées.
   Le padding de pied réserve la hauteur du dock : le bas de la liste reste
   atteignable en défilant au-dessus de l'accordéon qui, sinon, le recouvre. */
.maq-nav__scroll {
  pointer-events: auto;
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  padding-bottom: var(--maq-dock-h);
}

.maq-nav__scroll::-webkit-scrollbar {
  display: none;
}

.maq-nav__parts {
  padding: 0 0.6em;
}

/* Décrochement d'un cran par niveau d'imbrication : une largeur de colonne
   (chevron 1.1em + gap 0.35em) → le chevron d'un enfant s'aligne sous l'icône du
   parent. */
.maq-nav__sub {
  font-size: var(--fs-md);
  padding-left: 1.45em;
}

/* Une page liminaire : son rang + son select de type. */
.maq-nav__lim-page {
  display: flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.15em 0.5em 0.15em 0.35em;
}

.maq-nav__lim-num {
  flex: 0 0 auto;
  font-size: var(--fs-md);
  color: var(--c-muted);
  white-space: nowrap;
}

.maq-nav__lim-select {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--fs-sm);
}

/* Un type encore SUGGÉRÉ (non décidé) reprend la signature de l'indice (trait
   discontinu, teinte d'accent), comme dans LiminaireControls. */
.maq-nav__lim-select.has-suggestion {
  border: 1px dashed var(--c-accent);
  color: var(--c-accent);
}

.maq-nav__empty {
  padding: 0.25em 0.6em;
  font-size: var(--fs-sm);
  color: var(--c-muted);
  opacity: 0.7;
}

/* Dock accordéon : overlay ferré au bord gauche/bas (il ne réserve plus de hauteur).
   Plus large que le sommaire — la pellicule a besoin de la zone principale. */
.maq-nav__footer {
  position: absolute;
  left: -1em;
  bottom: 0;
  width: 66vw;
  pointer-events: auto;
}

/* StructureView est pensé pour la colonne d'aside (fond + décrochement sous la
   barre) ; ici il flotte, sans fond ni décrochement. La classe de scope de
   StructureView est posée SUR `.structure-panel`, d'où le ciblage direct. */
.maq-nav__toc :deep(.structure-panel) {
  margin-top: 0;
  background: transparent;
}

.maq-nav__toc :deep(.panel-content) {
  padding: 0.3em 0.6em 1em;
}
</style>
