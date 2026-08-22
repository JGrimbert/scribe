<template>
  <div class="maq-bar">
    <label class="maq-search">
      <i class="pi pi-search maq-search__icon"></i>
      <input
          ref="inputEl"
          v-model="query"
          type="search"
          class="maq-search__input"
          placeholder="Rechercher…"
          @focus="$emit('focus-search')"
      />
    </label>

    <div v-if="tallyRow" class="maq-tally">
      <span class="maq-tally__level">n°{{ tallyRow.index + 1 }}</span>
      <span
          class="maq-tally__pct"
          :title="`${tallyRow.validables} validables · ${tallyRow.valides} validés / ${tallyRow.total}`"
      >{{ pct }} %</span>

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

    <button
        type="button"
        class="maq-recal"
        :disabled="!recalibratable"
        :title="recalibratable ? 'Relire le .odt d’origine et redéfinir les bornes' : NO_SOURCE_HINT"
        @click="$emit('recalibrate')"
    >
      <i class="pi pi-refresh" aria-hidden="true"></i>
      <span>Redéfinir les bornes</span>
    </button>

    <label class="maq-bar__zoom">
      <span>Dézoom</span>

      <BaseSelect :model-value="zoom" @update:model-value="$emit('update:zoom', Number($event))">
        <option v-for="z in zooms" :key="z" :value="z">×{{ z }}</option>
      </BaseSelect>
    </label>

    <label class="maq-bar__presentation" v-if="showPresentationSelect">
      <span>Présentation</span>
      <BaseSelect :model-value="presentationMode" @update:model-value="$emit('update:presentationMode', $event)">
        <option v-for="mode in availableModes" :key="mode.value" :value="mode.value">
          {{ mode.label }}
        </option>
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
  // Le .odt d'origine est-il conservé ? Sinon le recalibrage est barré (seul un
  // réimport peut refixer les bornes).
  recalibratable: { type: Boolean, default: true },
  // La recherche est-elle ouverte ? L'état ne vit PLUS ici : c'est le calque
  // « Vocabulaire » de la pellicule, en tête de l'accordéon, qui le porte — on y
  // entre et on en sort à la molette. La barre ne fait que viser ce cran
  // (`focus-search` au focus du champ, `exit-search` sur Échap).
  searching: { type: Boolean, default: false },
  // Présentation
  presentationMode: { type: String, default: 'default' },
  availableModes: { type: Array, default: () => [] },
  showPresentationSelect: { type: Boolean, default: false },
})

// `update:query` : la maquette en fait ses résultats (la planche qui remplace
// l'aperçu). `recalibrate` : ouvre la modale de recalibration (l'hôte détient le
// flux).
const emit = defineEmits([
  'update:zoom', 'update:query', 'validate', 'recalibrate', 'focus-search', 'exit-search',
])

const NO_SOURCE_HINT =
    "Recalibrage impossible : le .odt d'origine n'a pas été conservé (document importé avant cette fonctionnalité). Seul un réimport permet de refixer les bornes."

const pct = computed(() => {
  const r = props.tallyRow
  return r?.total ? Math.round((r.validables / r.total) * 100) : 0
})

const query = ref('')
const inputEl = ref(null)

// Vider le champ ne ferme PLUS la recherche : elle n'est plus un état de la barre
// mais un cran de la pellicule. On en sort en scrollant l'accordéon (ou par Échap).
watch(query, (q) => emit('update:query', q))

function onDocKeydown(e) {
  // Échap vide ET sort : garder la saisie dans un champ dont la recherche est
  // close laisserait les deux états en désaccord.
  if (e.key !== 'Escape') return
  query.value = ''
  inputEl.value?.blur()
  emit('exit-search')
}

watch(() => props.searching, (isOpen) => {
  document[isOpen ? 'addEventListener' : 'removeEventListener']('keydown', onDocKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onDocKeydown))
</script>

<style scoped>
/* Bande pleine largeur, posée en absolu sous la doc-bar (elle ne pousse rien : le
   contenu de la maquette se décale par ses propres marges, cf. MaquetteView).
   Au-dessus du sommaire flottant (z 160), sous les modales (z 200). */
.maq-bar {
  border-bottom: 4px solid #e3dccd;
  position: absolute;
  top: var(--bar-size-2);
  left: 0;
  right: 0;
  height: var(--bar-size);
  z-index: 170;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  /* Alignée sur la colonne du sommaire (marge de .maq-nav + padding de sa carte). */
  padding-left: calc(2em + var(--sp-3));
  padding-right: 1em;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
  /*border-bottom: 1px solid var(--c-border);*/

  background: color-mix(in srgb, var(--c-floral-5) 78%, transparent);
  backdrop-filter: blur(2px) saturate(110%);
  -webkit-backdrop-filter: blur(2px) saturate(110%);

  /* La barre ne projette plus la grosse ombre uniforme (elle tombait identique sur
     nav et sur le fond → aucune différence lisible). Elle garde juste un fin
     détachement ; l'ombre PORTÉE est rendue côté récepteur : bande profonde sur le
     fond (.maquette::before) vs liseré clair sur le sommaire (.maq-nav::before). */
  box-shadow:
      0 1px 2px var(--c-shadow-1),
      0 2px 6px var(--c-shadow-2);

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
  font-size: .8em;
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

/* Recalibrage : bouton discret (ghost), MENEUR du cluster de droite — il porte le
   `margin-left: auto`, le dézoom se colle à lui. Ainsi recal+dézoom restent
   ensemble à droite, avec ou sans tally (qui a son propre auto et flotte au
   milieu quand elle est là). */
.maq-recal {
  margin-left: auto;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
  padding: 0.25em 0.6em;
  cursor: pointer;
}

.maq-recal:hover:not(:disabled) {
  border-color: var(--c-accent-alt);
  color: var(--c-accent-alt);
}

.maq-recal:disabled {
  opacity: var(--op-faint);
  cursor: default;
}

.maq-bar__zoom {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.maq-bar__presentation {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
</style>
