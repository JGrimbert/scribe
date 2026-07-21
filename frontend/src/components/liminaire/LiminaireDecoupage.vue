<template>
  <!-- Le découpage des SEULES pages du vis-à-vis au premier plan : c'est la
       seule vue qui montre les entrées, donc la seule où l'on puisse scinder.
       Le type se pose dans l'accordéon, pas ici — une page a un type, pas une
       entrée. La config est mutée EN PLACE (convention RuleSetForm). -->
  <div>
    <p v-if="!pages.length" class="lim-empty">{{ emptyLabel }}</p>

    <ol v-else class="pages">
      <li v-for="page in pages" :key="page.key" class="page" :class="{ 'page--blank': page.isBlank }">
        <!-- Le numéro flotte à droite, en pastille : c'est un repère, pas la
             première chose à lire. La tête ne porte plus que lui — le côté se
             pose désormais dans l'accordéon, contre le type. -->
        <span class="pnum">{{ page.ordinal + 1 }}</span>
        <span v-if="page.isBlank" class="blank-label">page blanche</span>

        <ul class="entries">
          <!-- « rattacher » ouvre la liste, dans la MÊME gouttière que
               « scinder » : les deux gestes déplacent une frontière, ils se
               lisent dans une seule colonne. -->
          <li v-if="page.ordinal > 0" class="entry entry--op">
            <button
                class="op"
                :class="{ 'op--active': breakOfKey(config, page.key) === 'joined' }"
                type="button"
                title="Rattacher cette page à la précédente"
                @click="toggleBreak(config, page.key, 'joined')"
            >
              <i class="pi pi-arrow-up"></i> rattacher
            </button>
          </li>

          <li v-for="(entry, ei) in page.entries" :key="entry.key" class="entry">
            <button
                v-if="ei > 0"
                class="op"
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
import { breakOfKey, entryPlainText, toggleBreak } from '../../script/liminaire'

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
  background-color: #fff;
}

/* Page blanche : structurante, pas du contenu — atténuée, en pointillés. */
.page--blank {
  border-style: dashed;
  opacity: var(--op-muted);
}

/* `float` et non un item flex : le numéro doit se ranger dans le coin et
   laisser le texte des entrées passer dessous, pas occuper une colonne à lui. */
.pnum {
  float: right;
  width: 1.7em;
  height: 1.7em;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--c-hover);
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}

.blank-label {
  font-size: var(--fs-sm);
  font-style: italic;
  color: var(--c-ink2);
}

/* Opérations de frontière : discrètes, révélées à l'usage. Plus de
   `margin-left: auto` — « rattacher » et « scinder » partagent la gouttière de
   gauche, c'est ce qui les donne à lire comme un même geste. */
.op {
  flex: 0 0 auto;
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

.entries {
  list-style: none;
  margin: 0;
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
