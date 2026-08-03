<template>
  <!-- Aside PLEINE HAUTEUR de l'écran Maquette, extraite de MaquetteView pour
       l'alléger. Ne montre QUE la section de la série focusée (prop
       `active-block` : Format · Liminaire · un niveau de chapitrage) ; à chaque
       changement l'ancienne s'efface puis la nouvelle apparaît en fondu
       (Transition out-in, opacité seule). -->
  <aside class="maq-aside">
    <Transition name="maq-rise" mode="out-in">
      <section :key="activeBlock" class="maq-aside__block" :data-block="activeBlock">
        <!-- Format : contrôles de page + en-têtes/pieds. -->
        <template v-if="activeBlock === 'format'">
          <header class="maq-sec-head">
            <i class="pi pi-file" aria-hidden="true"></i>
            <span>Format</span>
          </header>

          <MaquetteFormatControls :page="fmtPage" :style-defaults="styleDefaults" />
        </template>

        <!-- Liminaire : verdict d'éligibilité + jalon de fin. -->
        <template v-else-if="activeBlock === 'liminaire'">
          <header class="maq-sec-head">
            <i class="pi pi-bookmark" aria-hidden="true"></i>
            <span>Liminaire</span>
          </header>

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
          <header class="maq-sec-head">
            <i class="pi pi-list" aria-hidden="true"></i>
            <span>Chapitrage n°{{ activeChap.index + 1 }}</span>
          </header>
<!--

          <h4 class="maq-sub">Modèles relevés</h4>
          <StructureModelList :shape-group="activeChap.sec.shapeGroup" :interactive="false" />
-->
<!--
          <h4 class="maq-sub maq-sub&#45;&#45;spaced">Styles &amp; rôles</h4>-->
          <StyleRolesTable
              :styles="activeChap.sec.styles"
              :style-roles="styleRoles"
              show-require
              full-width
              :depth-key="activeChap.sec.depthKey"
              :zone-key="activeChap.sec.zone.key"
              :rule-set="activeChap.sec.ruleSet ?? rules.default"
              @hover-style="$emit('hover-style', $event)"
          />
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
import MaquetteFormatControls from './MaquetteFormatControls.vue'
import MaquetteLiminaireJalon from './MaquetteLiminaireJalon.vue'
import StyleRolesTable from '../config/StyleRolesTable.vue'
import StructureModelList from '../config/StructureModelList.vue'
import LiminaireEligibilite from '../liminaire/LiminaireEligibilite.vue'

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
  // Jeu de règles ({ default, byDepth }) — repli du modèle exigé.
  rules: { type: Object, required: true },
  // Clé de la série focusée (scroll-spy) : 'format' | 'liminaire' | 'chap-0'…
  activeBlock: { type: String, default: null },
})

defineEmits(['extend', 'exclude', 'hover-style'])

// Résolution 'chap-N' → la section de chapitrage (avec son rang) ; null pour
// 'format'/'liminaire' ou un index hors bornes.
const activeChap = computed(() => {
  const m = /^chap-(\d+)$/.exec(props.activeBlock || '')
  if (!m) return null
  const index = Number(m[1])
  const sec = props.chapSections[index]
  return sec ? { index, sec } : null
})
</script>

<style scoped>
/* Aside : une seule section visible à la fois (celle de la série focusée). Le
   padding-tête réserve la hauteur de la doc-bar. */
.maq-aside {
  display: flex;
  flex-direction: column;
  /*border-left: 1px solid teal;*/
  padding: calc(var(--bar-size) + 1.25em) var(--sp-4) var(--fs-xl);
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

/* En-tête de section (Format · Liminaire · Chapitrage n°X) : teal, présent,
   l'icône à gauche du titre, sans filet. */
.maq-sec-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0;
  color: var(--c-accent-alt-darker);
  font-size: var(--fs-h3);
  font-weight: 700;
}

.maq-sec-head i {
  font-size: 1.1em;
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

.maq-aside__placeholder {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}
</style>
