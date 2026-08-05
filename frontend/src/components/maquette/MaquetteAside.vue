<template>
  <!-- Aside PLEINE HAUTEUR de l'écran Maquette, extraite de MaquetteView pour
       l'alléger. Ne montre QUE la section de la série focusée (prop
       `active-block` : Format · Liminaire · un niveau de chapitrage) ; à chaque
       changement l'ancienne s'efface puis la nouvelle apparaît en fondu
       (Transition out-in, opacité seule). -->
  <aside class="maq-aside">
    <Transition name="maq-rise" mode="out-in">
      <section :key="activeBlock" class="maq-aside__block" :data-block="activeBlock">
        <!-- Format : plus rien ici — les réglages sont dockés sur l'aperçu
             (MaquetteFormatCallouts) et l'aside est masquée pour cette source. -->

        <!-- Validation : ce qui décide qu'un chapitre est en règle — le socle de
             règles par défaut, puis le sens donné à chaque surlignage. Rapatrié
             de l'écran de config, « Non situés » abandonné au passage. -->
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

        <!-- Liminaire : styles & rôles du vis-à-vis focusé (+ « ce qui précède »
             par style). Une planche liminaire ne porte que quelques styles, la
             table les suit. Pas de colonnes « exigé »/« succession » (elles visent
             un niveau de chapitrage). -->
        <template v-else-if="activeBlock === 'liminaire'">
          <StyleRolesTable
              :styles="limStyles"
              :style-roles="styleRoles"
              full-width
              show-precedes
              zone-key="liminaire"
              @hover-style="$emit('hover-style', $event)"
          />
        </template>

        <!-- Niveau de chapitrage : table des styles du modèle (rôle · exigé ·
             succession · ce qui précède), en pleine largeur. -->
        <template v-else-if="activeChap">
          <!-- Les styles du nœud INSPECTÉ (le modèle du niveau), dans l'ordre du
               texte : c'est une séquence, seule table où la puce de succession a
               un sens. -->
          <template v-if="chapStyles.model.length">
            <StyleRolesTable
                :styles="chapStyles.model"
                :style-roles="styleRoles"
                show-require
                show-precedes
                full-width
                :depth-key="activeChap.sec.depthKey"
                :zone-key="activeChap.sec.zone.key"
                :rule-set="activeChap.sec.ruleSet ?? rules.default"
                @hover-style="$emit('hover-style', $event)"
            />
          </template>
        </template>

        <p v-else class="maq-aside__placeholder">
          Aucune section à afficher.
        </p>
      </section>
    </Transition>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import StyleRolesTable from '../config/StyleRolesTable.vue'
import RuleSetForm from '../config/RuleSetForm.vue'
import HighlightsList from '../config/HighlightsList.vue'
import { splitByModel } from '../../script/chapitrageModele'

const props = defineProps({
  // Styles du vis-à-vis liminaire focusé (cf. spreadStyles), forme StyleRolesTable.
  limStyles: { type: Array, default: () => [] },
  // Sections de chapitrage enrichies (ruleSet/defaultRuleSet), une par niveau.
  chapSections: { type: Array, default: () => [] },
  // Map réactive rôle-par-style (mutée en place par StyleRolesTable).
  styleRoles: { type: Object, required: true },
  // Jeu de règles ({ default, byDepth }) — repli du modèle exigé, et socle édité
  // par le cran Validation.
  rules: { type: Object, required: true },
  // Surlignages relevés (inventory.highlights) + map réactive couleur → rôle,
  // mutée en place par HighlightsList. Cran Validation.
  highlightItems: { type: Array, default: () => [] },
  highlights: { type: Object, required: true },
  // La ventilation par zone est-elle disponible ? (StackedBar des surlignages)
  zoned: { type: Boolean, default: false },
  // Clé de la série focusée (scroll-spy) : 'format' | 'liminaire' | 'chap-0'…
  activeBlock: { type: String, default: null },
  // Styles du nœud INSPECTÉ au niveau focusé = le modèle (noms, dans l'ordre du
  // texte, cf. script/chapitrageModele.js). Vide tant que les formes ne sont pas
  // chargées : la table du niveau est alors entière, comme avant.
  modelNames: { type: Array, default: () => [] },
})

defineEmits(['hover-style'])

// Résolution 'chap-N' → la section de chapitrage (avec son rang) ; null pour
// 'format'/'liminaire' ou un index hors bornes.
const activeChap = computed(() => {
  const m = /^chap-(\d+)$/.exec(props.activeBlock || '')
  if (!m) return null
  const index = Number(m[1])
  const sec = props.chapSections[index]
  return sec ? { index, sec } : null
})

// Les styles du niveau, scindés : ceux du modèle (ordre du texte) et les autres
// (ordre de l'inventaire).
const chapStyles = computed(() => splitByModel(activeChap.value?.sec.styles ?? [], props.modelNames))
</script>

<style scoped>
/* Aside : une seule section visible à la fois (celle de la série focusée). Le
   padding-tête réserve la hauteur des DEUX barres (doc-bar + MaquetteBar). */
.maq-aside {
  display: flex;
  flex-direction: column;
  /*border-left: 1px solid teal;*/
  padding: calc(2 * var(--bar-size) + 1.25em) var(--sp-4) var(--fs-xl);
}

/* Un bloc = la section active, en CARTE FLOTTANTE (mêmes traits que les
   contrôles liminaire et le sommaire flottant). */
.maq-aside__block {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  /*padding: var(--sp-3);*/
  border: 1px solid #fff;
  border-radius: var(--radius-md);
  /*background: var(--c-card-float);*/
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

/* Sous-titre d'un pack (En-têtes et pieds · Modèle exigé · Styles & rôles). */
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
