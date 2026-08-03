<template>
  <!-- Surlignages relevés dans le .odt, un par couleur : la couleur, ses comptes,
       sa ventilation par zone, un échantillon, puis le rôle qu'on lui donne.
       Extrait de ConfigView pour que l'aside « Validation » de la maquette monte
       exactement le même bloc — deux copies divergeraient au premier réglage. -->
  <div class="hl-block">
    <p v-if="!items.length" class="hl-empty">Aucun surlignage relevé.</p>
    <ul v-else class="hl-list">
      <li v-for="hl in items" :key="hl.color" class="hl">
        <div class="hl-head">
          <span class="swatch" :style="{ background: hl.color }"></span>
          <code>{{ hl.color }}</code>
          <span class="hl-counts">{{ hl.paragraphs }} ¶ · {{ hl.spans }} inline</span>
        </div>
        <StackedBar v-if="zoned && totalOf(hl.byZone)" :segments="zoneSegments(hl.byZone)" />
        <p v-if="hl.sample" class="hl-sample" :title="hl.sample">{{ hl.sample }}</p>
        <BaseSelect v-model="highlights[hl.color]">
          <option v-for="role in HIGHLIGHT_ROLES" :key="role" :value="role">{{ role }}</option>
        </BaseSelect>
      </li>
    </ul>
  </div>
</template>

<script setup>
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import StackedBar from '../ui/atoms/StackedBar.vue'
import { HIGHLIGHT_ROLES } from '../../script/typology'
import { totalOf, zoneSegments } from '../../script/zones'

defineProps({
  // Inventaire des surlignages (inventory.highlights) : { color, paragraphs, spans, byZone, sample }.
  items: { type: Array, default: () => [] },
  // Map réactive couleur → rôle, MUTÉE EN PLACE (le parent détient l'objet).
  highlights: { type: Object, required: true },
  // La ventilation par zone est-elle disponible ? (documents importés avant elle)
  zoned: { type: Boolean, default: false },
})
</script>

<style scoped>
/* Une grille qui remplit la largeur plutôt qu'une colonne étroite : chaque
   surlignage se décide couleur par couleur, mais rien n'oblige à les empiler.
   En colonne étroite (aside de la maquette), le `minmax` retombe sur une seule
   colonne tout seul. */
.hl-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16em, 1fr));
  gap: var(--sp-4);
}

.hl {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-width: 0;
}

.hl-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
}

.swatch {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  vertical-align: -0.15em;
}

.hl-counts {
  margin-left: auto;
  color: var(--c-ink2);
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hl-sample {
  margin: 0;
  color: var(--c-ink2);
  font-family: var(--font-serif);
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hl-empty {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-md);
}
</style>
