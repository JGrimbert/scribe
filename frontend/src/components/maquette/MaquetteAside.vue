<template>
  <!-- Aside PLEINE HAUTEUR de l'écran Maquette, extraite de MaquetteView pour
       l'alléger. Empile TOUS les modules de toutes les sections (Format ·
       Liminaire · un bloc par niveau de chapitrage). Chaque section porte un
       en-tête « présent » (teal + icône à droite) ; le scroll-spy fait remonter
       la section correspondant à la série focusée (prop `active-block`). -->
  <aside ref="rootEl" class="maq-aside">
    <!-- Format : contrôles de page + en-têtes/pieds (packs remplis rendus par
         MaquetteFormatControls). -->
    <section class="maq-aside__block" data-block="format">
      <header class="maq-sec-head">
        <i class="pi pi-file" aria-hidden="true"></i>
        <span>Format</span>
      </header>

      <MaquetteFormatControls :page="fmtPage" :style-defaults="styleDefaults" />
    </section>

    <!-- Liminaire : verdict d'éligibilité + jalon de fin. -->
    <section class="maq-aside__block" data-block="liminaire">
      <header class="maq-sec-head">
        <i class="pi pi-bookmark" aria-hidden="true"></i>
        <span>Liminaire</span>
      </header>

      <h4 class="maq-sub">Éligibilité</h4>
      <LiminaireEligibilite :elig="elig" />

      <!-- Fin du liminaire : étendre/exclure (le jalon n'est plus qu'informatif). -->
      <h4 class="maq-sub maq-sub--spaced">Fin du liminaire</h4>
      <MaquetteLiminaireJalon
          :can-extend="limCanExtend"
          :next-title="limNextTitle"
          :border-shift="limBorderShift"
          @extend="$emit('extend')"
          @exclude="$emit('exclude')"
      />
    </section>

    <!-- Un bloc par niveau de chapitrage : modèle exigé puis table des styles
         (rôle · exigé · succession), en pleine largeur. -->
    <section
        v-for="(sec, i) in chapSections"
        :key="`chap-${i}`"
        class="maq-aside__block"
        :data-block="`chap-${i}`"
    >
      <header class="maq-sec-head">
        <i class="pi pi-list" aria-hidden="true"></i>
        <span>Chapitrage n°{{ i + 1 }}</span>
      </header>

      <h4 class="maq-sub">Modèles relevés</h4>
      <StructureModelList :shape-group="sec.shapeGroup" :interactive="false" />

      <h4 class="maq-sub maq-sub--spaced">Styles &amp; rôles</h4>
      <StyleRolesTable
          :styles="sec.styles"
          :style-roles="styleRoles"
          show-require
          full-width
          :depth-key="sec.depthKey"
          :zone-key="sec.zone.key"
          :rule-set="sec.ruleSet ?? rules.default"
      />
    </section>

    <p v-if="!chapSections.length" class="maq-aside__placeholder">
      Aucun niveau de chapitrage relevé.
    </p>
  </aside>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
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
  // Sections de chapitrage enrichies (ruleSet/defaultRuleSet), une par niveau.
  chapSections: { type: Array, default: () => [] },
  // Map réactive rôle-par-style (mutée en place par StyleRolesTable).
  styleRoles: { type: Object, required: true },
  // Jeu de règles ({ default, byDepth }) — repli du modèle exigé.
  rules: { type: Object, required: true },
  // Clé de la série focusée (scroll-spy) : 'format' | 'liminaire' | 'chap-0'…
  activeBlock: { type: String, default: null },
})

defineEmits(['extend', 'exclude'])

// Scroll-spy : changer de partie (série focusée) fait remonter la section
// correspondante en tête, sous la doc-bar (offset porté par scroll-margin-top).
const rootEl = ref(null)
watch(() => props.activeBlock, () => nextTick(() => {
  const key = props.activeBlock
  const target = key ? rootEl.value?.querySelector(`[data-block="${key}"]`) : null
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}))
</script>

<style scoped>
/* Contenu défilant de l'aside : les modules empilés. Le padding-tête réserve la
   hauteur de la doc-bar (au repos, Format est visible sous la barre ; il glisse
   dessous au scroll). */
.maq-aside {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
  /*border-left: 1px solid teal;*/
  padding: calc(var(--bar-size) + 1.25em) var(--sp-4) var(--sp-5);
}

/* Un bloc = une section (partie) de l'aside. Un léger padding hiérarchise chaque
   partie ; scroll-margin-top tient compte de la doc-bar quand le scroll-spy amène
   ce bloc en tête (scrollIntoView block:start). */
.maq-aside__block {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-2) var(--sp-3);
  scroll-margin-top: calc(var(--bar-size) + 1.25em);
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
