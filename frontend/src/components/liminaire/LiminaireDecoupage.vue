<template>
  <!-- Le découpage des SEULES pages du vis-à-vis au premier plan : c'est la
       seule vue qui montre les entrées, donc la seule où l'on puisse scinder.
       Le type se pose dans l'accordéon, pas ici — une page a un type, pas une
       entrée. La config est mutée EN PLACE (convention RuleSetForm). -->
  <div>
    <p v-if="!pages.length" class="lim-empty">{{ emptyLabel }}</p>

    <ol v-else class="pages">
      <li v-for="page in pages" :key="page.key" class="page" :class="{ 'page--blank': page.isBlank }">
        <div class="page-head">
          <span class="pnum">{{ page.ordinal + 1 }}</span>

          <template v-if="page.isBlank">
            <span class="blank-label">page blanche</span>
          </template>
          <template v-else>
            <BaseSelect
                class="pside"
                :model-value="sideOfPage(config, page)"
                @update:model-value="setPageSide(config, page, $event)"
            >
              <option v-for="s in PAGE_SIDES" :key="s" :value="s">{{ s }}</option>
            </BaseSelect>
            <span
                v-if="expectedSideOf(config, page)"
                class="expected"
                :class="{ conflict: isConflicting(config, page) }"
            >{{ expectedSideOf(config, page) }} attendu</span>
          </template>

          <button
              v-if="page.ordinal > 0"
              class="op"
              :class="{ 'op--active': breakOfKey(config, page.key) === 'joined' }"
              type="button"
              title="Rattacher cette page à la précédente"
              @click="toggleBreak(config, page.key, 'joined')"
          >
            <i class="pi pi-arrow-up"></i> rattacher
          </button>
        </div>

        <ul class="entries">
          <li v-for="(entry, ei) in page.entries" :key="entry.key" class="entry">
            <button
                v-if="ei > 0"
                class="op op--split"
                :class="{ 'op--active': breakOfKey(config, entry.key) === 'start' }"
                type="button"
                title="Démarrer une nouvelle page ici"
                @click="toggleBreak(config, entry.key, 'start')"
            >
              <i class="pi pi-arrow-down"></i> scinder
            </button>
            <span class="etext" :class="{ 'etext--empty': entry.isBlank }">{{ entryPlainText(entry) || '(vide)' }}</span>
          </li>
        </ul>
      </li>
    </ol>
  </div>
</template>

<script setup>
import BaseSelect from '../ui/BaseSelect.vue'
import {
  PAGE_SIDES,
  breakOfKey,
  entryPlainText,
  expectedSideOf,
  isConflicting,
  setPageSide,
  sideOfPage,
  toggleBreak,
} from '../../script/liminaire'

defineProps({
  // Les pages du vis-à-vis focusé (cf. pagesOfSpread) — pas tout le liminaire.
  pages: { type: Array, required: true },
  config: { type: Object, required: true },
  emptyLabel: { type: String, default: 'Rien à découper sur ce vis-à-vis.' },
})
</script>

<style scoped>
.lim-empty {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.pages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.page {
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: var(--sp-2);
}

/* Page blanche : structurante, pas du contenu — atténuée, en pointillés. */
.page--blank {
  border-style: dashed;
  opacity: var(--op-muted);
}

.page-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

.pnum {
  min-width: 1.6em;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-sm);
  color: var(--c-ink2);
}

.pside { font-size: var(--fs-sm); }

.blank-label {
  font-size: var(--fs-sm);
  font-style: italic;
  color: var(--c-ink2);
}

.expected {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  opacity: var(--op-muted);
}

.expected.conflict {
  color: var(--c-danger);
  opacity: 1;
  font-weight: 600;
}

/* Opérations de frontière : discrètes, révélées à l'usage. */
.op {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  border: 1px solid var(--c-border);
  border-radius: 1em;
  background: none;
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-xs);
  padding: 0.1em 0.7em;
  cursor: pointer;
  opacity: var(--op-muted);
}

.op:hover { opacity: 1; }

.op--active {
  opacity: 1;
  color: var(--c-accent);
  border-color: var(--c-accent);
}

.op--split {
  margin-left: 0;
  flex: 0 0 auto;
}

.entries {
  list-style: none;
  margin: var(--sp-2) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.entry {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}

.etext {
  font-family: var(--font-serif);
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.etext--empty {
  font-style: italic;
  opacity: var(--op-faint);
}
</style>
