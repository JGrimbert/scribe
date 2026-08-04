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

        <!-- Liminaire : verdict d'éligibilité + jalon de fin. -->
        <template v-else-if="activeBlock === 'liminaire'">
<!--
          <h4 class="maq-sub">Éligibilité</h4>
          <LiminaireEligibilite :elig="elig" />
-->
<!--
          &lt;!&ndash; Fin du liminaire : étendre/exclure (le jalon n'est plus qu'informatif). &ndash;&gt;
          <h4 class="maq-sub maq-sub&#45;&#45;spaced">Fin du liminaire</h4>
          <MaquetteLiminaireJalon
              :can-extend="limCanExtend"
              :next-title="limNextTitle"
              :border-shift="limBorderShift"
              @extend="$emit('extend')"
              @exclude="$emit('exclude')"
          />-->

          <!-- Styles du VIS-À-VIS focusé (et non de toute la zone) : une planche
               liminaire ne porte que quelques styles, la table les suit. Pas de
               colonnes « exigé »/« succession » — elles visent un niveau de
               chapitrage, le liminaire n'en a pas. -->
<!--          <h4 class="maq-sub maq-sub&#45;&#45;spaced">Styles &amp; rôles</h4>-->
          <StyleRolesTable
              :styles="limStyles"
              :style-roles="styleRoles"
              full-width
              zone-key="liminaire"
              @hover-style="$emit('hover-style', $event)"
          />
        </template>

        <!-- Niveau de chapitrage : modèle exigé puis table des styles (rôle ·
             exigé · succession), en pleine largeur. -->
        <template v-else-if="activeChap">
<!--

          <h4 class="maq-sub">Modèles relevés</h4>
          <StructureModelList :shape-group="activeChap.sec.shapeGroup" :interactive="false" />
-->
<!--
          <h4 class="maq-sub maq-sub&#45;&#45;spaced">Styles &amp; rôles</h4>-->
          <!-- Où en est la relecture du niveau : le décompte est monté dans la
               barre (MaquetteBar), il ne reste ici que ce qu'il veut dire. -->
<!--          <p class="maq-hint">
            <template v-if="tallyRows[activeChap.index]?.fromModel">
              Validable = iso modèle ci-dessous. Cocher « exigé » remplace ce critère.
            </template>
            <template v-else>Validable = les styles exigés à ce niveau.</template>
          </p>-->

          <!-- Les styles du nœud INSPECTÉ (le modèle du niveau), dans l'ordre du
               texte : c'est une séquence, seule table où la puce de succession a
               un sens. -->
          <template v-if="chapStyles.model.length">
<!--            <h4 class="maq-sub">
              Modèle <span v-if="modelLabel" class="maq-count">{{ modelLabel }}</span>
            </h4>-->
            <StyleRolesTable
                :styles="chapStyles.model"
                :style-roles="styleRoles"
                show-require
                full-width
                :depth-key="activeChap.sec.depthKey"
                :zone-key="activeChap.sec.zone.key"
                :rule-set="activeChap.sec.ruleSet ?? rules.default"
                @hover-style="$emit('hover-style', $event)"
            />
          </template>

          <!-- Styles HORS MODÈLE, SOUS le modèle et seulement en vue validation :
               la MÊME table (StyleRolesTable) enrichie — poids (compte coloré +
               part du problème) et bouton de fusion par ligne. Les lignes portent
               leurs métriques (cf. deviationStyleRows). -->
          <template v-if="validating && styleRows.length">
            <h4 class="maq-sub maq-sub--spaced">
              Hors modèle <span class="maq-count">{{ styleRows.length }}</span>
            </h4>
            <StyleRolesTable
                :styles="styleRows"
                :style-roles="styleRoles"
                show-fusion
                full-width
                :merging="merging"
                :depth-key="activeChap.sec.depthKey"
                :zone-key="activeChap.sec.zone.key"
                :rule-set="activeChap.sec.ruleSet ?? rules.default"
                @hover-style="$emit('hover-style', $event)"
                @merge="$emit('merge', $event)"
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
import MaquetteLiminaireJalon from './MaquetteLiminaireJalon.vue'
import StyleRolesTable from '../config/StyleRolesTable.vue'
import StructureModelList from '../config/StructureModelList.vue'
import RuleSetForm from '../config/RuleSetForm.vue'
import HighlightsList from '../config/HighlightsList.vue'
import LiminaireEligibilite from '../liminaire/LiminaireEligibilite.vue'
import { splitByModel } from '../../script/chapitrageModele'

const props = defineProps({
  // Format de page relevé du .odt (point de départ des contrôles).
  fmtPage: { type: Object, default: null },
  // styleDefaults muté en place par les contrôles (Format + en-têtes/pieds).
  styleDefaults: { type: Object, required: true },
  // Verdict d'éligibilité liminaire (deriveEligibility).
  elig: { type: Object, required: true },
  limCanExtend: { type: Boolean, default: true },
  limNextTitle: { type: String, default: null },
  limBorderShift: { type: Number, default: 0 },
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
  // Titre du nœud inspecté, pour dire de QUI le modèle est relevé.
  modelLabel: { type: String, default: null },
  // Décompte par niveau (cf. script/chapitrageValidation.js). Les chiffres eux-
  // mêmes sont affichés par MaquetteBar ; ici on n'en lit que `fromModel`, qui
  // décide de la phrase expliquant ce que « validable » veut dire à ce niveau.
  tallyRows: { type: Array, default: () => [] },
  // Styles HORS MODÈLE enrichis (cf. deviationStyleRows) : `[{ name, count,
  // problemShare, keep, gain }]`. Rendus sous le modèle, en vue validation.
  styleRows: { type: Array, default: () => [] },
  // Vue validation active (dézoom ×6) : sans elle, la table hors modèle reste
  // masquée (elle n'a de sens qu'à côté des familles d'écart).
  validating: { type: Boolean, default: false },
  // Une fusion réécrit le document : désarme les boutons le temps de l'opération.
  merging: { type: Boolean, default: false },
})

defineEmits(['extend', 'exclude', 'hover-style', 'merge'])

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
