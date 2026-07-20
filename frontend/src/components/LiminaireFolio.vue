<template>
  <!-- UN folio physique, rendu à l'identique par les trois vues de composition
       (planches, chemin de fer, accordéon). Sans état : le parent détient la
       config, ce composant ne fait qu'afficher et émettre. -->
  <div
      v-if="cell"
      class="folio"
      :class="{ 'folio--blank': cell.blank && !cell.cover, 'folio--cover': cell.cover, 'folio--implicit': cell.implicit }"
  >
    <span v-if="!cell.cover" class="folio-num">{{ cell.number }}</span>

    <template v-if="cell.cover">
      <span class="folio-blank-label">Page de garde</span>
    </template>

    <template v-else-if="cell.blank">
      <span class="folio-blank-label">{{ cell.implicit ? 'blanche · parité' : 'Page blanche' }}</span>
    </template>

    <template v-else>
      <button
          v-if="!compact && cell.page.ordinal > 0"
          class="folio-merge"
          type="button"
          title="Rattacher à la page précédente"
          :class="{ active: joined }"
          @click="$emit('toggle-merge')"
      >
        <i class="pi pi-arrow-up"></i>
      </button>

      <!-- COMPACT (accordéon) : la page ne porte QUE son verdict, les contrôles
           vivent sous la scène. Une page réduite et chevauchée ne se clique pas. -->
      <span v-if="compact" class="folio-typelabel" :class="{ 'is-empty': !type }">
        <i v-if="!type && suggestion" class="pi pi-bolt"></i>
        {{ type ? labelOf(type) : suggestion ? `${labelOf(suggestion.key)} ?` : '— non typé —' }}
      </span>

      <template v-else>
        <BaseSelect
            class="folio-type"
            :model-value="type"
            @update:model-value="$emit('update:type', $event)"
        >
          <option value="">— type —</option>
          <option v-for="t in LIMINAIRE_PAGES" :key="t.key" :value="t.key">{{ t.label }}</option>
        </BaseSelect>

        <button
            v-if="!type && suggestion"
            class="suggest folio-suggest"
            :class="`suggest--${suggestion.source}`"
            type="button"
            :title="suggestion.why"
            @click="$emit('apply-suggestion')"
        >
          <i class="pi" :class="suggestion.source === 'flou' ? 'pi-sparkles' : 'pi-bolt'"></i>
          <span v-if="suggestion.source === 'flou'">≈ </span>{{ labelOf(suggestion.key) }} ?
        </button>
      </template>

      <p class="folio-preview" :title="cell.page.preview">{{ cell.page.preview || '(vide)' }}</p>

      <button
          v-if="!compact"
          class="folio-sidebtn"
          type="button"
          :title="`Côté : ${side} — cliquer pour changer`"
          @click="$emit('cycle-side')"
      >{{ sideGlyph }}</button>
    </template>
  </div>

  <!-- Intérieur de couverture (la face de la page 1) : pas de folio à afficher. -->
  <div v-else class="folio folio--cover" aria-hidden="true"></div>
</template>

<script setup>
import { computed } from 'vue'
import BaseSelect from './ui/BaseSelect.vue'
import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY } from '../script/liminaire'

const props = defineProps({
  // Un slot d'imposition (cf. computeImposition) ou null pour un vis-à-vis vide.
  cell: { type: Object, default: null },
  type: { type: String, default: '' },
  suggestion: { type: Object, default: null },
  side: { type: String, default: 'auto' },
  joined: { type: Boolean, default: false },
  // Accordéon : page en lecture seule (les contrôles vivent sous la scène).
  compact: { type: Boolean, default: false },
})

defineEmits(['update:type', 'apply-suggestion', 'toggle-merge', 'cycle-side'])

const sideGlyph = computed(() =>
  props.side === 'recto' ? 'R' : props.side === 'verso' ? 'V' : '·',
)

function labelOf(key) {
  return LIMINAIRE_BY_KEY.get(key)?.label ?? key
}
</script>

<style scoped>
/* Le folio : un rectangle de page, ratio ~A5 portrait. */
.folio {
  position: relative;
  width: 100%;
  max-width: 13em;
  aspect-ratio: 1 / 1.414;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  border-radius: var(--radius-sm);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  padding: var(--sp-3) var(--sp-2) var(--sp-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  overflow: hidden;
}

.folio--blank {
  border-style: dashed;
  background: none;
  box-shadow: none;
}

.folio--cover {
  border: 1px dashed var(--c-border);
  background: repeating-linear-gradient(45deg, transparent, transparent 5px, var(--c-border) 5px, var(--c-border) 6px);
  opacity: var(--op-faint);
}

.folio--blank, .folio--cover {
  justify-content: center;
}


.folio-num {
  position: absolute;
  top: 0.25em;
  left: 0.4em;
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  opacity: var(--op-muted);
  font-variant-numeric: tabular-nums;
}

.folio-blank-label {
  font-size: var(--fs-xs);
  font-style: italic;
  color: var(--c-ink2);
  opacity: var(--op-muted);
}

.folio-type {
  width: 100%;
  font-size: var(--fs-sm);
  margin-top: var(--sp-2);
}

.folio-suggest {
  font-size: var(--fs-xs);
}

/* Verdict en lecture seule (accordéon) : le type posé, ou la suggestion en
   attente — reprise de la teinte d'accent pour qu'elle se lise « proposée ». */
.folio-typelabel {
  margin-top: var(--sp-2);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
}

.folio-typelabel.is-empty {
  font-weight: 500;
  color: var(--c-accent);
  opacity: var(--op-muted);
}

.folio-preview {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  text-align: center;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* Côté imposé/choisi : pastille en bas, cliquable pour cycler. */
.folio-sidebtn {
  margin-top: auto;
  width: 1.7em;
  height: 1.7em;
  border-radius: 50%;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
}

.folio-merge {
  position: absolute;
  top: 0.2em;
  right: 0.3em;
  border: 0;
  background: none;
  color: var(--c-ink2);
  font-size: var(--fs-xs);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s ease;
}

.folio:hover .folio-merge { opacity: var(--op-muted); }
.folio-merge:hover, .folio-merge.active { opacity: 1; color: var(--c-accent); }

/* Indice inline : une proposition à un clic, en teinte d'accent discrète. */
.suggest {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  border: 1px dashed var(--c-accent);
  border-radius: 1em;
  background: none;
  color: var(--c-accent);
  font: inherit;
  font-size: var(--fs-xs);
  padding: 0.1em 0.6em;
  cursor: pointer;
  opacity: var(--op-muted);
}

.suggest:hover { opacity: 1; }

/* Suggestion sémantique (floue) : ton distinct de l'accent (déterministe, sûr)
   pour que « deviné » ne se confonde pas avec « déduit ». */
.suggest--flou {
  border-color: var(--c-ink2);
  color: var(--c-ink2);
}
</style>
