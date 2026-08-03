<template>
  <!-- Colonne d'identité d'un nœud dans la liste d'un niveau de chapitrage : rang,
       titre, verdict, et ce qui manque le cas échéant. Composant à part parce que
       la rangée n°1 est le FolioView PERSISTANT de la scène (impossible à couler
       dans un v-for) : seule l'identité est partageable entre elle et les
       suivantes. -->
  <div class="node-ident">
    <span class="node-ident__rank">n° {{ rank }}</span>
    <span class="node-ident__title" :title="node.titre">{{ node.titre }}</span>
    <!-- Verdict : la validation MANUELLE prime (c'est une décision, pas un relevé) ;
         sinon le nœud passe ou non les contraintes de styles du niveau. -->
    <span class="node-ident__state" :class="`node-ident__state--${state}`">{{ STATE_LABELS[state] }}</span>
    <span v-if="lacks" class="node-ident__lacks" :title="lacks">{{ lacks }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // `{ nodeId, titre }` + verdict (`validable`, `missing`, `broken`) + validation
  // manuelle (`state`), cf. script/chapitrageValidation.js.
  node: { type: Object, required: true },
  rank: { type: Number, default: 1 },
})

const STATE_LABELS = {
  validé: 'validé',
  périmé: 'périmé',
  validable: 'validable',
  manquant: 'hors contraintes',
}

const state = computed(() => props.node.state || (props.node.validable ? 'validable' : 'manquant'))

// Ce qui manque, en clair : styles absents puis successions rompues.
const lacks = computed(() => {
  const n = props.node
  if (n.state === 'validé' || n.validable) return null
  const parts = [...(n.missing ?? []), ...(n.broken ?? []).map(([a, b]) => `${a} → ${b}`)]
  return parts.length ? parts.join(' · ') : null
})
</script>

<style scoped>
.node-ident {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding-top: var(--sp-1);
  border-top: 1px solid var(--c-border);
}

.node-ident__rank {
  color: var(--c-muted);
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
}

.node-ident__title {
  font-size: var(--fs-sm);
  font-weight: 600;
  /* Trois lignes au plus : un titre long ne doit pas pousser la rangée. */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Verdict : une pastille de texte, pas un badge coloré plein — la colonne doit
   rester lisible en survol rapide de plusieurs rangées. */
.node-ident__state {
  font-size: var(--fs-xs);
  font-weight: 600;
}

.node-ident__state--validé {
  color: var(--c-status-valide);
}

.node-ident__state--périmé {
  color: var(--c-status-perime);
}

.node-ident__state--validable {
  color: var(--c-accent-alt);
}

.node-ident__state--manquant {
  color: var(--c-muted);
}

/* Ce qui manque : deux lignes au plus, le `title` porte la liste entière. */
.node-ident__lacks {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
