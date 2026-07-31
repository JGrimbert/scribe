<template>
  <!-- Pellicule générique : une suite de vis-à-vis (l'unité de focus) qui se
       chevauchent en profondeur, seul le focusé à pleine taille (les autres à
       0.75, OPAQUES). Les vis-à-vis sont regroupés en SECTIONS (Format ·
       Liminaire · Chapitrage) : au sein d'une section ils se recouvrent sans
       séparation ; entre deux sections un INTERVALLE net les isole. Chaque
       section est introduite par un onglet-jalon posé DANS cet intervalle, juste
       devant sa première page. La liste plate des crans arrive déjà construite
       (chaque cran porte sa section : `sectionKey`/`sectionLabel`/`isSectionStart`). -->
  <div class="maq-accordeon">
    <div ref="stageEl" class="maq-stage" @wheel.prevent="onWheel">
      <!-- Pellicule posée à plat, centrée et réduite d'un bloc pour tenir ENTIÈRE dans
           la scène (aucune coupure). Les positions internes (crans/jalons) sont fixes
           en em ; seul le translate + l'échelle globale (fitScale) bougent. -->
      <div class="maq-strip" :style="stripStyle">
        <!-- Vis-à-vis. Le rendu de la cellule est délégué au parent (une source
             décide de son contenu) ; défaut = vis-à-vis nu. -->
        <div
            v-for="(cran, i) in crans"
            :key="`s${i}`"
            class="maq-cran"
            :class="{ 'is-focused': i === focused }"
            :style="accStyle(i)"
            @click="$emit('update:focused', i)"
        >
          <slot name="spread" :cran="cran">
            <MaquetteSpreadCell />
          </slot>
        </div>

        <!-- Onglets d'entrée de section : nom à la verticale, posés dans l'intervalle
             qui précède la première page de leur section. Appuyés quand leur section
             est focusée. Rendus APRÈS les crans pour passer au premier plan. -->
        <div
            v-for="tab in sectionTabs"
            :key="`j${tab.startIndex}`"
            class="maq-jalon"
            :class="{ 'is-active': tab.sectionKey === focusedSection }"
            :style="jalonStyle(tab.startIndex)"
        >
          <span class="maq-jalon__name">{{ tab.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import MaquetteSpreadCell from './MaquetteSpreadCell.vue'
import { useWheelStepper } from '../../composables/useWheelStepper'

const props = defineProps({
  // Liste PLATE des vis-à-vis dans l'ordre de lecture. Chaque cran porte sa source
  // (`sourceKey`) ET sa section (`sectionKey`/`sectionLabel`/`isSectionStart`). La
  // ventilation en sections vit chez le parent.
  crans: { type: Array, required: true },
  focused: { type: Number, required: true },
  // Ratio largeur/hauteur d'UNE page : fixe la largeur d'un vis-à-vis (2 pages), donc
  // la géométrie de la pellicule (intervalles réels entre groupes).
  ratio: { type: Number, default: 148 / 210 },
  // Plafond du retrait EN Y : au-delà de `dropSpan` crans d'écart avec le focus,
  // on ne descend plus (l'escalier s'arrête). L'écart HORIZONTAL, borné par le
  // conteneur, suffit à distinguer les crans qui se chevauchent.
  dropSpan: { type: Number, default: 2 },
})

const emit = defineEmits(['update:focused'])

const ACC_DROP = 10

// Géométrie en unités RÉELLES (em). Tous les vis-à-vis ont la même largeur (deux
// pages au ratio effectif) → on ménage de VRAIS intervalles vides entre groupes.
// (L'ancrage normalisé qui remplissait la largeur faisait chevaucher les feuillets
// par-dessus les coutures et posait les jalons sur les pages.)
const CARD_H = 10.5    // hauteur d'un feuillet focusé, cf. .maq-cran
const GROUP_GAP = 2.6  // vide entre deux groupes ET marge de tête (accueille l'onglet)
const OVERLAP = 0.34   // pas intra-section, en fraction de la largeur d'un feuillet

// Section du cran focusé → son onglet est appuyé.
const focusedSection = computed(() => props.crans[props.focused]?.sectionKey ?? null)

// Un onglet par section, ancré sur son PREMIER vis-à-vis (isSectionStart).
const sectionTabs = computed(() =>
  props.crans
    .map((c, i) => ({ sectionKey: c.sectionKey, label: c.sectionLabel, isSectionStart: c.isSectionStart, startIndex: i }))
    .filter((c) => c.isSectionStart),
)

// Centre X (em) de chaque feuillet le long de la pellicule posée à plat. Intra-section
// les centres se serrent (chevauchement) ; à chaque entrée de section, saut d'une
// largeur pleine + un vide (GROUP_GAP) → intervalle net, jamais couvert par un feuillet.
// Marges de tête et de queue = GROUP_GAP → pellicule d'aplomb quand on la centre.
const layout = computed(() => {
  const cw = 2 * CARD_H * props.ratio
  const stepIn = OVERLAP * cw
  const centers = []
  let c = GROUP_GAP + cw / 2
  props.crans.forEach((cran, i) => {
    if (i > 0) c += cran.isSectionStart ? cw + GROUP_GAP : stepIn
    centers.push(c)
  })
  const last = centers.length ? centers[centers.length - 1] : 0
  return { centers, cw, stripW: last + cw / 2 + GROUP_GAP }
})

// Largeur de la scène EN EM (mesurée) : arbitre entre centrage (ça tient) et
// panoramique (ça déborde). 0 tant que non monté → on centre par défaut.
const stageEl = ref(null)
const stageWEm = ref(0)
let ro
onMounted(() => {
  const measure = () => {
    const el = stageEl.value
    if (!el) return
    const emPx = parseFloat(getComputedStyle(el).fontSize) || 16
    stageWEm.value = el.clientWidth / emPx
  }
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(stageEl.value)
})
onBeforeUnmount(() => ro?.disconnect())

// Échelle d'ajustement : 1 si la pellicule tient, sinon on la réduit pour que TOUT
// tienne dans la scène SANS COUPURE (feuillets plus petits, mais rien de rogné).
const fitScale = computed(() => {
  const sw = stageWEm.value
  const { stripW } = layout.value
  return !sw || stripW <= sw ? 1 : sw / stripW
})

// Pellicule ancrée à gauche:50% (origine left-top) : on la réduit (fitScale) puis on
// la recentre horizontalement (translate d'une demi-largeur réduite).
const stripStyle = computed(() => {
  const s = fitScale.value
  const tx = -(layout.value.stripW * s) / 2
  return { transform: `translateX(${tx.toFixed(3)}em) scale(${s.toFixed(4)})` }
})

function accStyle(i) {
  const dist = Math.abs(i - props.focused)
  const drop = Math.min(dist, props.dropSpan) * ACC_DROP
  const scale = i === props.focused ? 1 : 0.75
  return {
    left: `${layout.value.centers[i].toFixed(3)}em`,
    transform: `translateX(-50%) translateY(${drop}px) scale(${scale})`,
    zIndex: String(props.crans.length - dist),
  }
}

// L'onglet se pose au CENTRE du vide qui précède sa section (jamais sur un feuillet) ;
// il accompagne le retrait Y de sa première page. Pas d'échelle : une étiquette nue
// doit rester lisible, quelle que soit la section focusée.
function jalonStyle(startIndex) {
  const { centers } = layout.value
  const x = startIndex === 0 ? GROUP_GAP / 2 : (centers[startIndex - 1] + centers[startIndex]) / 2
  const dist = Math.abs(startIndex - props.focused)
  const drop = Math.min(dist, props.dropSpan) * ACC_DROP
  return {
    left: `${x.toFixed(3)}em`,
    transform: `translateX(-50%) translateY(${drop}px)`,
  }
}

const { onWheel } = useWheelStepper({
  slideCount: computed(() => props.crans.length),
  focused: computed(() => props.focused),
  onStep: (next) => emit('update:focused', next),
})
</script>

<style scoped lang="scss">
.maq-accordeon {
  display: flex;
  flex-direction: column;
}

.maq-stage {
  position: relative;
  /* Talon serré sous le feuillet focusé (top 2.4em + 10.5em = 12.9em). */
  height: 13.2em;
  overflow: hidden;
}

/* Pellicule : contexte de positionnement des crans/jalons. Ancrée à gauche:50%,
   origine left-top → réduite (fitScale) puis recentrée par translate. */
.maq-strip {
  position: absolute;
  top: 0;
  left: 50%;
  height: 100%;
  transform-origin: left top;
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

/* Vis-à-vis : hauteur fixe (les cellules la remplissent, largeur au ratio de page
   → jamais de débordement vertical hors du stage). OPAQUE (plus de désaturation) ;
   seule l'échelle distingue les crans en retrait. Origine top-center pour que la
   réduction garde les pages alignées en tête. */
.maq-cran {
  position: absolute;
  top: 2.4em;
  height: 10.5em;
  cursor: pointer;
  transform-origin: top center;
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.13));

  &.is-focused {
    cursor: default;
  }
}

/* Onglet d'entrée de section : étiquette NUE (ni cadre ni fond), au premier plan,
   centrée dans l'intervalle qui précède la section. */
.maq-jalon {
  position: absolute;
  top: 2.4em;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.4em;
  height: 10.5em;
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
  pointer-events: none;
}

/* Nom vertical lisible de BAS EN HAUT (vertical-rl + rotation 180°). Grisé au repos ;
   la couleur seule (pas la graisse) distingue la section focusée. */
.maq-jalon__name {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  font-size: var(--fs-xs);
  font-weight: 500;
  letter-spacing: 0.05em;
  white-space: nowrap;
  color: var(--c-muted);
  transition: color 0.2s ease;
}

/* Section focusée : étiquette en bleu (accent-alt, un peu plus clair). */
.maq-jalon.is-active .maq-jalon__name {
  color: var(--c-accent-alt);
}
</style>
