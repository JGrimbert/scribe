<template>
  <!-- Panneau de la scène « Annotations » (dernier cran de la pellicule), en
       regard des lambeaux : ce qu'on DIT du texte, après ce qui le compose.
       L'avancement de la rédaction en tête — à sa taille NATURELLE, il pousse ce
       qui suit — puis les deux modules qui le décident : le seuil qu'on impose et
       les chapitres que ça laisse en attente. Les surlignages, eux, sont passés en
       menu de filtres sur la liste des annotations (cf. MaquetteAnnotationFilters) :
       ils y règlent ce qu'on regarde, ce qui n'est pas le propos de cette colonne. -->
  <CustomScrollbar class="maq-annot">
    <div class="maq-annot__inner">
      <section class="maq-annot__states">
        <h4 class="maq-annot__title">Avancement</h4>
        <CompletenessChart />
      </section>

      <div class="maq-annot__cols">
      <section class="maq-annot__col">
        <h4 class="maq-annot__title">Seuil de rédaction</h4>
        <p class="maq-annot__hint">
          S'applique à tout niveau de chapitrage qui n'a pas ses propres règles.
        </p>
        <RuleSetForm :rule-set="rules.default" />
        <!-- Le compte se dit tout de suite : régler un seuil sans voir ce qu'il
             disqualifie revient à choisir un chiffre au hasard. -->
        <p v-if="minChars == null" class="maq-annot__hint maq-annot__hint--spaced">
          Aucun seuil : la longueur d'un chapitre ne le disqualifie jamais.
        </p>
        <template v-else>
          <p class="maq-annot__tally">
            <strong>{{ shortNodes.length }}</strong> chapitre(s) sur {{ charCounts.length }}
            sous {{ minChars }} caractères.
          </p>
          <ul v-if="shortNodes.length" class="maq-annot__shorts">
            <li v-for="n in shownShorts" :key="n.id" class="maq-annot__short">
              <span class="maq-annot__short-title">{{ n.titre }}</span>
              <span class="maq-annot__short-chars">{{ n.chars }}</span>
            </li>
          </ul>
          <p v-if="hiddenShorts > 0" class="maq-annot__hint">+ {{ hiddenShorts }} autres</p>
        </template>
      </section>

        <section class="maq-annot__col maq-annot__col--table">
          <AnomaliesTable />
        </section>
      </div>
    </div>
  </CustomScrollbar>
</template>

<script setup>
import { computed } from 'vue'
import CompletenessChart from '../analyse/structure/CompletenessChart.vue'
import AnomaliesTable from '../analyse/structure/AnomaliesTable.vue'
import RuleSetForm from '../config/RuleSetForm.vue'
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'

const props = defineProps({
  // Jeu de règles ({ default, byDepth }) — seul le socle se règle ici.
  rules: { type: Object, required: true },
  // Les nœuds et leur poids en caractères (cf. script/annotations).
  charCounts: { type: Array, default: () => [] },
})

// Tronqué plutôt que scrollé : la colonne dit combien, pas qui — le tableau des
// chapitres est à côté (et la règle qu'on est en train de poser se juge sur le
// compte, pas sur la traîne).
const MAX_SHORTS = 8

const minChars = computed(() => props.rules.default?.minChars ?? null)

// Le SEUL décompte en caractères de l'écran, et il est calculé ici : le « mots »
// du backend répond à une autre question (chapitre entamé ou non), pas à celle
// de la règle.
const shortNodes = computed(() => (
  minChars.value == null ? [] : props.charCounts.filter((n) => n.chars < minChars.value)
))
const shownShorts = computed(() => shortNodes.value.slice(0, MAX_SHORTS))
const hiddenShorts = computed(() => shortNodes.value.length - shownShorts.value.length)
</script>

<style scoped>
/* Le panneau DÉFILE : l'avancement se dimensionne sur le nombre d'axes du livre
   (barres grasses, chiffres au chaud dedans) et pousse ce qui suit. Le borner à
   une fraction de la hauteur — ce qu'on faisait — écrasait les barres au point
   que les chiffres n'y tenaient plus. */
.maq-annot {
  height: 100%;
  min-height: 0;
  font-size: var(--fs-sm);
}

.maq-annot__inner {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  padding: var(--sp-2) var(--sp-4) var(--sp-5);
}

.maq-annot__states {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.maq-annot__cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-5);
  align-items: start;
}

/* Une colonne : sa pile de contrôles. Elle ne se borne plus à une rangée — c'est
   le panneau qui défile — mais sa largeur, elle, reste bornée. */
.maq-annot__col {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-width: 0;
}

.maq-annot__title {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink2);
}

.maq-annot__count {
  opacity: var(--op-faint);
  font-weight: 400;
}

.maq-annot__hint {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-xs);
}

.maq-annot__hint--spaced {
  margin-top: var(--sp-3);
}

/* Les marges verticales des blocs empruntés (RuleSetForm) doublent le `gap` de la
   colonne : sur une fenêtre basse, ce doublon suffisait à faire déborder la
   colonne alors que son contenu tenait. */
.maq-annot__col :deep(.rules) {
  margin-top: 0;
}

.maq-annot__tally {
  margin: 0;
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
}

.maq-annot__shorts {
  list-style: none;
  margin: 0;
  padding: 0;
}

.maq-annot__short {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  padding: 0.15em 0;
  border-bottom: 1px solid var(--c-border);
  font-size: var(--fs-xs);
}

.maq-annot__short-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.maq-annot__short-chars {
  flex: 0 0 auto;
  color: var(--c-muted);
  font-variant-numeric: tabular-nums;
}
</style>
