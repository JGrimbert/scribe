<template>
  <div
      class="tree-row"
      :class="[
        `tree-row--${variant}`,
        { 'tree-row--current': current, 'tree-row--accented': accentColor, 'tree-row--columns': columns },
      ]"
      :style="accentColor ? { borderLeftColor: accentColor } : null"
      :title="tooltip"
      @click="$emit('open')"
  >
    <!-- Mode colonnes (opt-in) : chevron EN TÊTE, puis colonne icône, puis texte.
         Une feuille (zéro chevron) NE réserve PAS la colonne chevron — son icône
         prend le slot de tête et s'aligne donc sous l'icône du dossier parent (le
         décrochement d'un cran vaut une colonne). -->
    <template v-if="columns">
      <button
          v-if="expandable"
          type="button"
          class="tree-row__caret"
          :class="{ 'tree-row__caret--open': expanded }"
          :title="expanded ? 'Replier' : 'Déplier'"
          @click.stop="$emit('toggle')"
      >
        <i class="pi pi-angle-right"></i>
      </button>
      <span class="tree-row__leaf"><i class="pi" :class="leadingIcon || 'pi-file'"></i></span>
    </template>

    <!-- Ordre historique : icône de tête AVANT le chevron. Une feuille porte son
         fichier (ou son `leadingIcon`) ; une ligne dépliable dotée d'un `leadingIcon`
         le pose devant son chevron. -->
    <template v-else>
      <span v-if="!expandable" class="tree-row__leaf"><i class="pi" :class="leadingIcon || 'pi-file'"></i></span>
      <span v-else-if="leadingIcon" class="tree-row__leaf tree-row__leaf--icon"><i class="pi" :class="leadingIcon"></i></span>
      <button
          v-if="expandable"
          type="button"
          class="tree-row__caret"
          :class="{ 'tree-row__caret--open': expanded }"
          :title="expanded ? 'Replier' : 'Déplier'"
          @click.stop="$emit('toggle')"
      >
        <i class="pi pi-angle-right"></i>
      </button>
    </template>

    <span class="tree-row__label" :class="{ 'tree-row__label--normalized': normalizeCase }">
      <slot />
    </span>

    <slot name="trailing" />
  </div>
</template>

<script setup>
defineProps({
  // list : ligne dense de sidebar — card : ligne posée sur fond (calibration)
  variant: {
    type: String,
    default: 'list',
    validator: (v) => ['list', 'card'].includes(v),
  },
  expandable: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
  // Layout en colonnes fixes chevron | icône | texte (chevron en tête, colonne
  // toujours réservée). Opt-in — l'ordre par défaut reste icône puis chevron.
  columns: { type: Boolean, default: false },
  current: { type: Boolean, default: false },
  // liseret sémantique optionnel (ex : niveau de titre en calibration) —
  // jamais décoratif.
  accentColor: { type: String, default: null },
  // bas de casse + initiale capitale (rendu unifié de la sidebar)
  normalizeCase: { type: Boolean, default: false },
  tooltip: { type: String, default: null },
  // Icône de tête optionnelle (classe PrimeIcons, ex : 'pi-folder'). Sur une feuille
  // elle remplace le fichier ; sur une ligne dépliable elle s'ajoute après le chevron.
  leadingIcon: { type: String, default: null },
})

defineEmits(['open', 'toggle'])
</script>

<style scoped>
.tree-row {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.tree-row--list {
  gap: 0.35em;
  padding: 0.25em 0.5em 0.25em 0.35em;
  border-radius: var(--radius-sm);
  font-size: var(--fs-md);
}

.tree-row--list:hover,
.tree-row--list.tree-row--current {
  background: var(--c-surface3);
}

.tree-row--list.tree-row--current {
  font-weight: 700;
}

.tree-row--card {
  gap: 0.6em;
  padding: 0.65em 1em;
  margin-bottom: 0.35em;
  background: var(--c-surface4);
  border-left: 4px solid transparent;
  border-radius: var(--radius-md);
}

.tree-row--card:hover {
  filter: brightness(0.97);
}

.tree-row__caret {
  flex: 0 0 auto;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  width: 1.1em;
  opacity: 0.55;
  line-height: 1;
  text-align: left;
}

.tree-row__caret i {
  font-size: 0.8em;
  display: inline-block;
  transition: transform 0.15s ease;
}

.tree-row__caret--open i {
  transform: rotate(90deg);
}

.tree-row__caret:hover {
  opacity: 1;
}

/* Mode colonnes : le `<button>` du chevron n'hérite pas de `font-size` (défaut UA),
   contrairement au spacer `<span>` — sans ça la largeur 1.1em diffère et les
   colonnes icône (feuille vs dossier) ne s'alignent pas au pixel. */
.tree-row--columns .tree-row__caret {
  font-size: inherit;
}

.tree-row__leaf {
  flex: 0 0 auto;
  width: 1.1em;
  opacity: var(--op-faint);
  line-height: 1;
}

.tree-row__leaf i {
  font-size: 0.8em;
}

.tree-row__label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Casse unifiée (le span est un item flex, donc blockifié —
   ::first-letter s'applique). */
.tree-row__label--normalized {
  text-transform: lowercase;
}

.tree-row__label--normalized::first-letter {
  text-transform: uppercase;
}
</style>
