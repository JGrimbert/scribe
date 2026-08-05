<template>
  <!-- Entre les flèches : le(s) type(s) du vis-à-vis au premier plan. Un vis-à-vis
       peut porter DEUX pages taguables (mentions | dédicace). -->
  <div class="acc-nav">
    <button type="button" class="acc-arrow" title="Vis-à-vis précédent" :disabled="focused === 0" @click="$emit('update:focused', focused - 1)">
      <i class="pi pi-chevron-left"></i>
    </button>

    <div class="acc-controls">
      <div v-for="ctl in focusedControls" :key="ctl.side" class="acc-control">
        <!-- Slot inerte (blanche / couverture) : même gabarit, même liseré, pour
             que la barre garde exactement la même largeur. -->
        <span v-if="ctl.kind === 'inert'" class="acc-inert">{{ ctl.label }}</span>
        <BaseSelect
            v-if="ctl.kind === 'page'"
            class="acc-select"
            :class="{ 'has-suggestion': ctl.pending }"
            :title="ctl.pending ? ctl.pending.why : ''"
            :model-value="ctl.type"
            @update:model-value="$emit('set-type', ctl.page, $event)"
        >
          <!-- UNE SEULE ligne porte la suggestion : la ligne courante (le
               placeholder), lisible au repos. La liste ne la répète pas — le type
               y garde son libellé nu, seulement mis en couleur pour qu'on voie où
               cliquer pour l'appliquer. -->
          <option value="">{{ ctl.pending ? `⚡ ${labelOf(ctl.pending.key)} ?` : '— type —' }}</option>
          <option
              v-for="t in LIMINAIRE_PAGES"
              :key="t.key"
              :value="t.key"
              :class="{ 'opt-suggest': ctl.pending && ctl.pending.key === t.key }"
          >{{ t.label }}</option>
        </BaseSelect>
      </div>
    </div>

    <button type="button" class="acc-arrow" title="Vis-à-vis suivant" :disabled="focused >= spreads.length" @click="$emit('update:focused', focused + 1)">
      <i class="pi pi-chevron-right"></i>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY } from '../../script/liminaire-vocab'

const props = defineProps({
  spreads: { type: Array, required: true },
  focused: { type: Number, required: true },
  types: { type: Object, required: true },
  suggestions: { type: Object, required: true },
})

const emit = defineEmits(['update:focused', 'set-type'])

function typeOfCell(cell) {
  return cell?.page ? (props.types[cell.page.key] ?? '') : ''
}

function suggestionOfCell(cell) {
  return cell?.page ? (props.suggestions[cell.page.key] ?? null) : null
}

// Les pages taguables du vis-à-vis au premier plan — jusqu'à DEUX (le verso et le
// recto peuvent porter chacun un type : mentions | dédicace).
// TOUJOURS deux entrées (verso puis recto), même quand une seule est taguable :
// une page blanche ou la couverture rend un bloc inerte de même gabarit. Sans lui,
// la barre se rétrécirait et LES FLÈCHES BOUGERAIENT d'un vis-à-vis à l'autre — le
// flux doit rester absolument fixe.
const focusedControls = computed(() => {
  // Cran terminal : rien à taguer, mais un slot inerte quand même — un conteneur
  // vide rétrécirait la barre et déplacerait les flèches.
  if (props.focused === props.spreads.length) {
    return [{ side: 'extend', kind: 'inert', label: 'Fin du liminaire' }]
  }
  const sp = props.spreads[props.focused]
  if (!sp) return []
  return [
    { cell: sp.left, side: 'verso' },
    { cell: sp.right, side: 'recto' },
  ].map(({ cell, side }) => {
    if (!cell || cell.cover) return { side, kind: 'inert', label: 'Page de garde' }
    if (cell.blank) return { side, kind: 'inert', label: 'Page blanche' }
    const type = typeOfCell(cell)
    return {
      side,
      kind: 'page',
      key: cell.page.key,
      page: cell.page,
      type,
      // `pending` = une suggestion NON encore décidée. Un type déjà posé referme
      // la question : le select redevient un select ordinaire.
      pending: type ? null : suggestionOfCell(cell),
    }
  })
})

function labelOf(key) {
  return LIMINAIRE_BY_KEY.get(key)?.label ?? key
}
</script>

<style scoped>
/* Zone d'inputs, SOUS la réglette : flèche · type(s) · flèche. */
.acc-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
}

.acc-arrow {
  flex: 0 0 auto;
  width: 2em;
  height: 2em;
  border: 1px solid var(--c-border);
  border-radius: 50%;
  background: var(--c-surface);
  color: var(--c-ink2);
  font: inherit;
  cursor: pointer;
}

.acc-arrow:hover:not(:disabled) { border-color: var(--c-accent); color: var(--c-accent); }
.acc-arrow:disabled { opacity: var(--op-faint); cursor: default; }

/* Largeur FIXE, pas dérivée du contenu : un cran qui porte un seul slot (ou
   aucun) rétrécirait la barre et FERAIT BOUGER LES FLÈCHES d'un cran à l'autre.
   Le flux doit rester absolument fixe. */
.acc-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  /* `nowrap` + hauteur FIXE : c'est ce qui rend la barre insensible à son
     contenu. En `wrap`, deux slots de 13em plus le bouton de côté frôlaient la
     largeur disponible et basculaient sur deux lignes — la barre grandissait
     alors en hauteur selon le vis-à-vis regardé. */
  flex-wrap: nowrap;
  height: 2.2em;
  width: calc(26em + var(--sp-3));
}

/* Gabarit FIXE : les deux slots font la même largeur quoi qu'ils contiennent,
   donc les flèches ne bougent jamais d'un vis-à-vis à l'autre. Un seul contrôle
   par slot désormais (le select de type) — le côté recto/verso a migré vers la
   table des styles (`precedes`). */
.acc-control {
  flex: 0 0 13em;
  display: flex;
  /* Le slot occupe TOUTE la hauteur de la barre et son enfant s'y étire : select
     et liseré inerte font alors exactement la même hauteur. */
  height: 100%;
  align-items: stretch;
}

.acc-select,
.acc-inert {
  flex: 1 1 auto;
  min-width: 0;
}

/* Slot inerte : le liseré du select à l'identique (mêmes padding, bordure,
   rayon, taille) — mais discontinu et sourd, pour dire « rien à décider ici ». */
.acc-inert {
  width: 100%;
  padding: 0.35em 0.5em;
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-md);
  background: none;
  font-size: var(--fs-md);
  font-style: italic;
  color: var(--c-ink2);
  opacity: var(--op-muted);
  text-align: center;
}

/* Un type encore SUGGÉRÉ (non décidé) : le select reprend la signature de
   l'indice — trait discontinu et teinte d'accent — pour qu'on lise « proposé »
   et non « choisi ». La 1re ligne du menu applique la suggestion. */
.acc-select.has-suggestion {
  border-style: dashed;
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.acc-select .opt-suggest {
  color: var(--c-accent);
  font-weight: 600;
}
</style>
