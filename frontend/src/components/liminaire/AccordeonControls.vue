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
        <!-- Le côté se pose CONTRE le type qui le conditionne : la convention du
             type propose un côté, ce bouton l'arbitre. Cyclable plutôt que
             déroulant — trois valeurs, c'est un geste, pas une liste. Il vit DANS
             le slot du type pour que la largeur du bloc ne change pas : un contrôle
             de plus ferait bouger les flèches. -->
        <button
            v-if="ctl.kind === 'page'"
            type="button"
            class="acc-side"
            :class="{ 'is-conflict': ctl.conflict, 'is-auto': ctl.chosenSide === 'auto' }"
            :title="sideTitle(ctl)"
            @click.stop="cycleSide(ctl)"
        >{{ SIDE_MARKS[ctl.chosenSide] }}</button>
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
import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY, PAGE_SIDES } from '../../script/liminaire-vocab'

const props = defineProps({
  spreads: { type: Array, required: true },
  focused: { type: Number, required: true },
  types: { type: Object, required: true },
  suggestions: { type: Object, required: true },
  sides: { type: Object, default: () => ({}) },
  expectedSides: { type: Object, default: () => ({}) },
  conflicts: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:focused', 'set-type', 'set-side'])

// Marques d'un caractère : le bouton doit tenir dans le slot du type sans le
// rogner. « · » = auto (personne n'a tranché), R/V = imposé à la main.
const SIDE_MARKS = { auto: '·', recto: 'R', verso: 'V' }

function cycleSide(ctl) {
  const next = PAGE_SIDES[(PAGE_SIDES.indexOf(ctl.chosenSide) + 1) % PAGE_SIDES.length]
  emit('set-side', ctl.page, next)
}

function sideTitle(ctl) {
  const pose = ctl.chosenSide === 'auto' ? 'Côté libre' : `Forcé en ${ctl.chosenSide}`
  if (ctl.conflict) return `${pose} — mais le type appelle un ${ctl.expected}`
  if (ctl.expected) return `${pose} · le type appelle un ${ctl.expected}`
  return `${pose} (cliquer pour changer)`
}

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
    const key = cell.page.key
    return {
      side,
      kind: 'page',
      key,
      page: cell.page,
      type,
      // `side` du contrôle = le côté CHOISI (auto par défaut), à ne pas confondre
      // avec `side` du slot, qui dit verso/recto dans la planche.
      chosenSide: props.sides[key] ?? 'auto',
      expected: props.expectedSides[key] ?? null,
      conflict: !!props.conflicts[key],
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
   donc les flèches ne bougent jamais d'un vis-à-vis à l'autre. */
/* Grille et non flex : les DEUX colonnes existent toujours, que le slot porte
   un bouton de côté ou non. Un slot inerte (blanche, couverture, cran terminal)
   laisse la seconde colonne vide mais RÉSERVÉE — sans quoi son select
   s'élargirait de 2em et les libellés ne s'aligneraient plus d'un vis-à-vis à
   l'autre. */
.acc-control {
  flex: 0 0 13em;
  display: grid;
  grid-template-columns: 1fr 2em;
  gap: var(--sp-1);
  /* Le slot occupe TOUTE la hauteur de la barre et ses enfants s'y étirent :
     un select, un liseré inerte et une pastille de côté font alors exactement
     la même hauteur. Laissé à leur taille naturelle, le bloc inerte tombait
     2 px sous le select. */
  height: 100%;
  align-items: stretch;
}

/* `grid-row: 1` EXPLICITE sur les deux : le bouton de côté précède le select
   dans le DOM, et le placement automatique, une fois passé en colonne 2, aurait
   renvoyé le select à la ligne suivante — la barre montait alors sur deux
   rangées. */
.acc-select,
.acc-inert {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
}

/* Pastille d'un caractère, dans la colonne qui lui est réservée. */
.acc-side {
  grid-column: 2;
  grid-row: 1;
  /* Épouse la hauteur du select plutôt qu'une valeur en dur : si la métrique du
     select bouge, les deux restent d'aplomb. */
  align-self: stretch;
  width: 2em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface0);
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-md);
  font-weight: 600;
  cursor: pointer;
}

.acc-side:hover { border-color: var(--c-accent); color: var(--c-accent); }

/* Personne n'a tranché : le point se fait discret, sinon « · » se lit comme une
   décision au même titre que R ou V. */
.acc-side.is-auto { color: var(--c-ink2); opacity: var(--op-muted); }

/* Le côté forcé contredit la convention du type — c'est le seul état qui réclame
   l'œil. */
.acc-side.is-conflict {
  border-color: var(--c-danger);
  color: var(--c-danger);
  opacity: 1;
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
