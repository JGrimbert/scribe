<template>
  <!-- Menu de filtres de la liste des annotations, en tête de sa colonne de
       lambeaux. C'est l'ancien module « Surlignages » : il ne quitte pas l'écran,
       il change de rôle. Une couleur y dit trois choses — ce qu'elle marque
       (l'échantillon, en infobulle), ce qu'elle vaut (son rôle) et si on la regarde
       (le filtre). Le rôle reste ici : c'est le seul endroit qui le porte encore,
       une couleur typée autrement qu'`annotation` n'alimente plus la liste.

       Un MENU et non une bande dépliée, pour une raison de layout : la bande vit
       dans la colonne du folio, sa hauteur dépendait de sa largeur, sa largeur de
       la géométrie émise par le folio, et cette géométrie de la hauteur qui lui
       restait — boucle de rétroaction dont Paged.js sortait sans jamais paginer.
       Le bouton, lui, a une hauteur constante ; le volet est hors flux. -->
  <div class="af">
    <button
        type="button"
        class="af__toggle"
        :class="{ 'is-open': open }"
        :aria-expanded="open"
        @click="open = !open"
    >
      <i class="pi pi-filter" aria-hidden="true"></i>
      <span>Filtres</span>
      <span class="af__tally">{{ activeCount }}/{{ annotationCount }}</span>
    </button>

    <div v-if="open" class="af__panel">
      <p v-if="!items.length" class="af__empty">Aucun surlignage relevé.</p>
      <ul v-else class="af__list">
        <li v-for="hl in items" :key="hl.color" class="af__row">
          <button
              type="button"
              class="af__chip"
              :class="{ 'is-off': muted.includes(hl.color), 'is-inert': highlights[hl.color] !== 'annotation' }"
              :title="chipTitle(hl)"
              :disabled="highlights[hl.color] !== 'annotation'"
              @click="$emit('toggle', hl.color)"
          >
            <span class="af__swatch" :style="{ background: hl.color }"></span>
            <span class="af__count">{{ hl.paragraphs + hl.spans }}</span>
          </button>
          <BaseSelect
              class="af__role"
              :model-value="highlights[hl.color]"
              @update:model-value="highlights[hl.color] = $event"
          >
            <option v-for="role in HIGHLIGHT_ROLES" :key="role" :value="role">{{ role }}</option>
          </BaseSelect>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import { HIGHLIGHT_ROLES } from '../../script/typology'

const props = defineProps({
  // Inventaire des surlignages : { color, paragraphs, spans, byZone, sample }.
  items: { type: Array, default: () => [] },
  // Map réactive couleur → rôle, MUTÉE EN PLACE (le parent détient l'objet).
  highlights: { type: Object, required: true },
  // Couleurs momentanément retirées de la liste (filtre d'affichage, non persisté).
  muted: { type: Array, default: () => [] },
})

defineEmits(['toggle'])

const open = ref(false)

// Le compte porté par le bouton dit d'un coup d'œil si la liste est complète :
// « 3/4 » = une couleur est écartée, ce que le volet fermé ne montrerait pas.
const annotationColors = computed(() =>
  props.items.map((hl) => hl.color).filter((c) => props.highlights[c] === 'annotation'),
)
const annotationCount = computed(() => annotationColors.value.length)
const activeCount = computed(() => annotationColors.value.filter((c) => !props.muted.includes(c)).length)

// L'échantillon relevé dans le .odt en infobulle : c'est lui qui dit ce que la
// couleur marque, donc ce qui permet de choisir son rôle.
function chipTitle(hl) {
  return hl.sample || `${hl.paragraphs} paragraphe(s), ${hl.spans} passage(s)`
}
</script>

<style scoped>
/* Repère du volet, qui est hors flux : la racine ne prend que la hauteur du
   bouton, et elle ne varie jamais — cf. le commentaire du template. */
.af {
  position: relative;
  align-self: flex-start;
}

.af__toggle {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0.25em 0.6em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-card-float);
  backdrop-filter: var(--c-backdrop-filter-blur);
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-xs);
  cursor: pointer;
}

.af__toggle:hover,
.af__toggle.is-open {
  color: var(--c-accent-alt-darker);
  border-color: var(--c-accent-alt);
}

.af__tally {
  font-variant-numeric: tabular-nums;
  opacity: var(--op-faint);
}

/* Volet : posé SOUS le bouton, hors du flux — il recouvre le haut de la planche
   le temps qu'on règle les filtres, il ne la rétrécit pas. */
.af__panel {
  position: absolute;
  top: calc(100% + 0.3em);
  left: 0;
  z-index: 4;
  min-width: 14em;
  padding: var(--sp-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface0);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

.af__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.af__row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

/* La pastille EST le filtre : appuyée = la couleur alimente la liste. Éteinte,
   elle garde sa teinte mais perd son opacité — on doit voir ce qu'on a retiré. */
.af__chip {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 0.15em 0.4em;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.af__chip:hover:not(:disabled) {
  border-color: var(--c-border);
}

.af__chip.is-off {
  opacity: var(--op-faint);
}

/* Couleur qui n'est pas une annotation : elle n'alimente rien, son filtre n'a
   donc rien à commuter. On la montre quand même — c'est ici qu'on la type. */
.af__chip.is-inert {
  cursor: default;
  opacity: var(--op-muted);
}

.af__swatch {
  display: inline-block;
  width: 0.9em;
  height: 0.9em;
  flex: 0 0 auto;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
}

.af__role {
  margin-left: auto;
  font-size: var(--fs-xs);
}

.af__empty {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-xs);
}
</style>
