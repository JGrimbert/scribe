<template>
  <!-- Troisième rangée de l'écran Maquette, empilée sous le menu principal et la
       doc-bar : la RECHERCHE à gauche (elle a quitté la doc-bar, puis la carte du
       sommaire flottant), le DÉZOOM à droite. Deux réglages permanents de l'écran
       — pas des actions, d'où une bande sans fond propre, juste un filet. Au
       milieu, le seul élément CONTEXTUEL : l'avancement du niveau de chapitrage
       focusé (l'aside n'a plus ni titre de section ni tableau de décompte). -->
  <div class="maq-bar">
    <!-- Loupe teal, champ sans bord ni fond : la barre porte le cadre, pas lui. -->
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

    <!-- Une seule ligne, celle du niveau focusé : « n°2 · 63 % ». Le détail
         chiffré vit dans l'infobulle — la barre n'est pas un tableau de bord. -->
    <div v-if="tallyRow" class="maq-tally">
      <span class="maq-tally__level">n°{{ tallyRow.index + 1 }}</span>
      <span
          class="maq-tally__pct"
          :title="`${tallyRow.validables} validables · ${tallyRow.valides} validés / ${tallyRow.total}`"
      >{{ pct }} %</span>

      <!-- Validation du niveau : ouvre le volet des familles de cas ferré en bas
           de fenêtre. Re-clic : le referme. -->
      <button
          type="button"
          class="maq-tally__action"
          :class="{ 'maq-tally__action--on': validating }"
          :aria-pressed="validating"
          :title="validating ? 'Fermer la validation' : 'Valider ce niveau'"
          @click="$emit('validate')"
      >
        <i class="pi pi-check-square" aria-hidden="true"></i>
      </button>
    </div>

    <label class="maq-bar__zoom">
      <span>Dézoom</span>
      <!-- `.number` ne traverse pas un v-model de composant (BaseSelect ne lit pas
           modelModifiers) : la conversion se fait ici. -->
      <BaseSelect :model-value="zoom" @update:model-value="$emit('update:zoom', Number($event))">
        <option v-for="z in zooms" :key="z" :value="z">×{{ z }}</option>
      </BaseSelect>
    </label>
  </div>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'

const props = defineProps({
  zoom: { type: Number, required: true },
  zooms: { type: Array, required: true },
  // Décompte du SEUL niveau de chapitrage focusé (cf. chapitrageValidation.js) :
  // `{ index, total, validables, valides }`. null hors chapitrage (Format,
  // Liminaire, Validation) : le groupe disparaît alors de la barre.
  tallyRow: { type: Object, default: null },
  // Le volet de validation (familles de cas) est-il ouvert ?
  validating: { type: Boolean, default: false },
})

// `update:searching` : la maquette replie son accordéon tant que la recherche est
// ouverte, et le rend tel quel à la fermeture. `update:query` : elle en fait ses
// résultats (la planche qui remplace l'aperçu).
const emit = defineEmits(['update:zoom', 'update:searching', 'update:query', 'validate'])

const pct = computed(() => {
  const r = props.tallyRow
  return r?.total ? Math.round((r.validables / r.total) * 100) : 0
})

const query = ref('')
const open = ref(false)
const inputEl = ref(null)

watch(query, (q) => {
  emit('update:query', q)
  // Champ vidé = recherche close. Le champ vit maintenant dans une barre, pas
  // dans la carte du sommaire : « clic dehors » fermerait la recherche au premier
  // clic sur la scène, alors que TOUT l'écran est devenu son résultat (planche de
  // passages, accordéon d'analyse). La sortie est donc explicite.
  if (!q) open.value = false
})

function onDocKeydown(e) {
  // Échap vide ET ferme : garder la saisie dans un champ dont la recherche est
  // close laisserait les deux états en désaccord.
  if (e.key !== 'Escape') return
  query.value = ''
  open.value = false
  inputEl.value?.blur()
}

watch(open, (isOpen) => {
  emit('update:searching', isOpen)
  document[isOpen ? 'addEventListener' : 'removeEventListener']('keydown', onDocKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onDocKeydown))
</script>

<style scoped>
/* Bande pleine largeur, posée en absolu sous la doc-bar (elle ne pousse rien : le
   contenu de la maquette se décale par ses propres marges, cf. MaquetteView).
   Au-dessus du sommaire flottant (z 160), sous les modales (z 200). */
.maq-bar {
  position: absolute;
  top: var(--bar-size);
  left: 0;
  right: 0;
  height: var(--bar-size);
  z-index: 170;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  /* Alignée sur la colonne du sommaire (marge de .maq-nav + padding de sa carte). */
  padding-left: calc(1em + var(--sp-3));
  padding-right: 1em;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
  border-bottom: 1px solid var(--c-border);
  backdrop-filter: var(--c-backdrop-filter-blur);
}

/* Le champ ne prend pas toute la barre : il reste au-dessus de la colonne du
   sommaire, d'où il vient. Le dézoom se ferre à l'autre bout. */
.maq-search {
  flex: 0 1 26em;
  display: flex;
  align-items: center;
  gap: 1em;
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

/* Chrome/Safari : retire la croix native du type=search (double emploi visuel). */
.maq-search__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

/* Deux `margin-left: auto` (ici et sur le dézoom) : l'espace libre se partage,
   le groupe se pose entre la recherche et le dézoom sans largeur imposée. */
.maq-tally {
  margin-left: auto;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.maq-tally__level {
  opacity: var(--op-muted);
}

.maq-tally__pct {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: default;
}

/* Reprise du .maq-sec-action de l'aside (l'en-tête de section a disparu). */
.maq-tally__action {
  display: flex;
  align-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0.2em 0.35em;
  border-radius: var(--radius-sm);
  font-size: var(--fs-md);
}

.maq-tally__action:hover {
  color: var(--c-accent-alt);
}

/* Validation ouverte : la bascule reste enfoncée — la scène a changé d'état, le
   bouton doit dire lequel. */
.maq-tally__action--on {
  color: var(--c-accent-alt);
  background: color-mix(in srgb, var(--c-accent-alt) 12%, transparent);
}

.maq-bar__zoom {
  margin-left: auto;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
</style>
