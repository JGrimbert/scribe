<template>
  <!-- Aside PLEINE HAUTEUR de l'écran Maquette, réservée à la VALIDATION (règles par
       défaut + surlignages). Format, liminaire et chapitrage se pilotent par les
       callouts posés SUR la planche (MaquetteFormatCallouts / MaquetteStyleCallouts) ;
       leurs tables d'aside (styles · rôles · précède · exigé) ont été retirées. -->
  <aside class="maq-aside">
    <Transition name="maq-rise" mode="out-in">
      <section :key="activeBlock" class="maq-aside__block" :data-block="activeBlock">
        <!-- Validation : ce qui décide qu'un chapitre est en règle — le socle de
             règles par défaut, puis le sens donné à chaque surlignage. -->
        <template v-if="activeBlock === 'validation'">
          <h4 class="maq-sub">Règles par défaut</h4>
          <p class="maq-hint">
            S'appliquent à tout niveau de chapitrage qui n'a pas ses propres règles.
          </p>
          <RuleSetForm :rule-set="rules.default" />

          <h4 class="maq-sub maq-sub--spaced">
            Surlignages <span class="maq-count">{{ highlightItems.length }}</span>
          </h4>
          <p class="maq-hint">Un surlignage marque l'état du texte, pas sa structure.</p>
          <HighlightsList :items="highlightItems" :highlights="highlights" :zoned="zoned" />
        </template>

        <p v-else class="maq-aside__placeholder">
          Aucune section à afficher.
        </p>
      </section>
    </Transition>
  </aside>
</template>

<script setup>
import RuleSetForm from '../config/RuleSetForm.vue'
import HighlightsList from '../config/HighlightsList.vue'

defineProps({
  // Jeu de règles ({ default, byDepth }) — socle édité par le cran Validation.
  rules: { type: Object, required: true },
  // Surlignages relevés (inventory.highlights) + map réactive couleur → rôle,
  // mutée en place par HighlightsList. Cran Validation.
  highlightItems: { type: Array, default: () => [] },
  highlights: { type: Object, required: true },
  // La ventilation par zone est-elle disponible ? (StackedBar des surlignages)
  zoned: { type: Boolean, default: false },
  // Clé de la série focusée (scroll-spy) : 'validation' quand l'aside est visible.
  activeBlock: { type: String, default: null },
})
</script>

<style scoped>
/* Aside : une seule section visible à la fois (celle de la série focusée). Le
   padding-tête réserve la hauteur des DEUX barres (doc-bar + MaquetteBar). */
.maq-aside {
  display: flex;
  flex-direction: column;
  padding: calc(2 * var(--bar-size) + 1.25em) var(--sp-4) var(--fs-xl);
}

/* Un bloc = la section active, en CARTE FLOTTANTE (mêmes traits que les
   contrôles liminaire et le sommaire flottant). */
.maq-aside__block {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  border: 1px solid #fff;
  border-radius: var(--radius-md);
  backdrop-filter: var(--c-backdrop-filter-blur);
}

/* Changement de série : l'ancienne section s'efface, puis la nouvelle apparaît
   en fondu (mode out-in) — simple opacité, aucun déplacement. */
.maq-rise-enter-active {
  transition: opacity 0.35s ease;
}

.maq-rise-leave-active {
  transition: opacity 0.18s ease;
}

.maq-rise-enter-from,
.maq-rise-leave-to {
  opacity: 0;
}

/* Sous-titre d'un pack (Règles par défaut · Surlignages). */
.maq-sub {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink2);
}

.maq-sub--spaced {
  margin-top: var(--sp-2);
}

/* Ligne d'explication sous un sous-titre (cran Validation). */
.maq-hint {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.maq-count {
  opacity: var(--op-faint);
  font-weight: 400;
}

.maq-aside__placeholder {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}
</style>
