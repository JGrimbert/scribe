<template>
  <!-- Pellicule générique : une suite de vis-à-vis (l'unité de focus) qui se
       chevauchent en profondeur, seul le focusé à pleine taille (les autres à
       0.75, OPAQUES). Les vis-à-vis sont regroupés en ZONES (Format · Liminaire ·
       Chapitrage) : une zone = UNE balise (`MaquetteAccordeonSection`) portant son
       onglet-jalon ET ses vis-à-vis. Une zone DÉPLIÉE étale ses feuillets (pas
       OVERLAP) ; PLIÉE, elle les empile (recouvrement 95 %) et rend la place aux
       autres. La liste plate des crans arrive déjà construite (chaque cran porte
       sa zone : `sectionKey`/`sectionLabel`/`isSectionStart`). -->
  <div class="maq-accordeon" @mouseenter="atRest = false" @mouseleave="atRest = true">
    <!-- `.stop` : deux accordéons cohabitent à l'écran (la pellicule du livre et
         celle de l'analyse, ferrée à droite). Sans lui, une molette au-dessus de
         l'un pourrait remonter et faire défiler l'autre. -->
    <div class="maq-stage" @wheel.stop.prevent="onWheel">
      <!-- Pellicule posée à plat, à TAILLE FIXE : elle n'est jamais mise à l'échelle
           pour tenir dans la scène (sinon plier une zone, qui la raccourcit, ferait
           grossir les feuillets). Ce qui dépasse du bord opposé à son ferrage est
           simplement clippé — plier une zone est justement ce qui rend la place aux
           suivantes. Ferrée à DROITE, la pellicule se décale de sa propre longueur
           pour finir au bord (les offsets, eux, restent comptés dans le sens de
           lecture). -->
      <div class="maq-strip" :class="`is-${align}`" :style="stripStyle">
        <MaquetteAccordeonSection
            v-for="sec in sections"
            :key="sec.key"
            :label="sec.label"
            :items="sec.items"
            :focused="focused"
            :offset="sec.offset"
            :card-width="layout.cw"
            :step="sec.step"
            :head-gap="GROUP_GAP"
            :level="sec.level"
            :active="sec.key === focusedSection"
            :drop-span="dropSpan"
            @toggle="cycleSection(sec.key)"
            @focus-cran="$emit('update:focused', $event)"
        >
          <template #spread="{ cran }">
            <!-- Le rendu de la cellule est délégué au parent (une source décide de
                 son contenu) ; défaut = vis-à-vis nu. -->
            <slot name="spread" :cran="cran">
              <MaquetteSpreadCell />
            </slot>
          </template>
        </MaquetteAccordeonSection>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import MaquetteAccordeonSection from './MaquetteAccordeonSection.vue'
import MaquetteSpreadCell from './MaquetteSpreadCell.vue'
import { useWheelStepper } from '../../composables/useWheelStepper'

const props = defineProps({
  // Liste PLATE des vis-à-vis dans l'ordre de lecture. Chaque cran porte sa source
  // (`sourceKey`) ET sa zone (`sectionKey`/`sectionLabel`/`isSectionStart`). La
  // ventilation en zones vit chez le parent.
  crans: { type: Array, required: true },
  focused: { type: Number, required: true },
  // Niveau de pli par zone (v-model:folds) : `{ [sectionKey]: 'open'|'stack'|'tab' }`,
  // défaut `open`. Pilotable de l'extérieur (la recherche replie tout).
  //   open  — feuillets étalés (pas OVERLAP)
  //   stack — feuillets empilés, recouvrement 95 %
  //   tab   — zone réduite à son onglet, feuillets effacés
  folds: { type: Object, default: () => ({}) },
  // Ratio largeur/hauteur d'UNE page : fixe la largeur d'un vis-à-vis (2 pages), donc
  // la géométrie de la pellicule (intervalles réels entre groupes).
  ratio: { type: Number, default: 148 / 210 },
  // Plafond du retrait EN Y : au-delà de `dropSpan` crans d'écart avec le focus,
  // on ne descend plus (l'escalier s'arrête). L'écart HORIZONTAL, borné par le
  // conteneur, suffit à distinguer les crans qui se chevauchent.
  dropSpan: { type: Number, default: 2 },
  // Bord auquel la pellicule est ferrée : 'left' (le livre) ou 'right' (l'analyse,
  // dock indépendant à l'autre bout de la bande).
  align: { type: String, default: 'left' },
  // Repos : hors survol du dock, toutes les zones se réduisent à leur onglet — la
  // pellicule n'est plus qu'une file d'onglets, en X seulement (RIEN ne bouge en
  // Y : les feuillets restent à leur hauteur, ils se recouvrent). C'est un ÉTAT
  // (comme la recherche), pas une préférence : `folds` n'est pas touché et se
  // retrouve intact au survol.
  collapseOnLeave: { type: Boolean, default: false },
})

const emit = defineEmits(['update:focused', 'update:folds'])

const atRest = ref(true)
const resting = computed(() => props.collapseOnLeave && atRest.value)

// Géométrie en unités RÉELLES (em). Tous les vis-à-vis ont la même largeur (deux
// pages au ratio effectif) → on ménage de VRAIS intervalles vides entre groupes.
// (L'ancrage normalisé qui remplissait la largeur faisait chevaucher les feuillets
// par-dessus les coutures et posait les jalons sur les pages.)
const CARD_H = 10.5    // hauteur d'un feuillet focusé, cf. .maq-cran
const GROUP_GAP = 2.6  // vide entre deux zones ET marge de tête (accueille l'onglet)
const OVERLAP = 0.34   // pas intra-zone dépliée, en fraction de la largeur d'un feuillet
const OVERLAP_FOLDED = 0.05 // zone pliée : les feuillets se recouvrent à 95 %
const TAB_W = 1.6      // zone réduite à son onglet : jalons resserrés (le bouton fait 1.4em, l'air autour est mince)

// Cycle du clic sur un onglet.
const LEVELS = ['open', 'stack', 'tab']

// Zone du cran focusé → son onglet est appuyé.
const focusedSection = computed(() => props.crans[props.focused]?.sectionKey ?? null)

// Regroupement de la liste plate en zones (une entrée de zone ouvre un groupe).
const groups = computed(() => {
  const out = []
  props.crans.forEach((cran, index) => {
    if (!out.length || cran.isSectionStart) out.push({ key: cran.sectionKey, label: cran.sectionLabel, items: [] })
    out[out.length - 1].items.push({ cran, index })
  })
  return out
})

// Position (em) de chaque zone le long de la pellicule posée à plat. Une zone
// occupe son vide de tête (GROUP_GAP, qui l'isole de la précédente et accueille
// son onglet) puis ses feuillets, serrés du pas courant. Réduite à son onglet,
// elle n'occupe plus que `TAB_W` : la zone suivante se colle à son onglet et le
// reste ne compte plus (feuillets effacés). Le pli ne change QUE les offsets :
// les feuillets gardent leur taille (aucune échelle globale).
const layout = computed(() => {
  const cw = 2 * CARD_H * props.ratio
  let x = 0
  const sections = groups.value.map((g) => {
    const pref = LEVELS.includes(props.folds[g.key]) ? props.folds[g.key] : 'open'
    const level = resting.value ? 'tab' : pref
    const step = (level === 'open' ? OVERLAP : OVERLAP_FOLDED) * cw
    const sec = { ...g, level, step, offset: x }
    x += level === 'tab' ? TAB_W : GROUP_GAP + cw + (g.items.length - 1) * step
    return sec
  })
  // `stripEnd` = où s'arrête la pellicule, donc où commence l'espace libre (le
  // panneau du dock s'y pose).
  return { cw, sections, stripEnd: x }
})

const sections = computed(() => layout.value.sections)

// Ferrage à droite : la pellicule recule de sa propre longueur pour finir au bord
// droit de la scène. Elle suit donc le pli (une zone repliée la raccourcit et tout
// glisse vers la droite), d'où la transition sur `.is-right`.
const stripStyle = computed(() =>
  props.align === 'right' ? { transform: `translateX(-${layout.value.stripEnd.toFixed(3)}em)` } : null,
)

// Clic sur un onglet : déplié → empilé → onglet seul → déplié. Une zone encore
// absente de `folds` vaut 'open' (sinon le premier clic n'avancerait pas).
function cycleSection(key) {
  const cur = Math.max(0, LEVELS.indexOf(props.folds[key] ?? 'open'))
  emit('update:folds', { ...props.folds, [key]: LEVELS[(cur + 1) % LEVELS.length] })
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

/* Hauteur CONSTANTE : talon serré sous le feuillet focusé (top 2.4em + 10.5em =
   12.9em). Elle ne dépend plus du pli — la bande que l'aperçu réserve au dock
   (`--maq-dock-h` dans MaquetteView) doit rester d'accord avec cette valeur. */
.maq-stage {
  position: relative;
  height: 13.2em;
}

/* Pellicule : contexte de positionnement des zones. Jamais mise à l'échelle ; ce
   qui dépasse du bord opposé au ferrage est clippé par la scène. */
.maq-strip {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
}

/* Ferrée à droite : l'origine passe au bord droit, le recul de la longueur de la
   pellicule est posé en inline (cf. stripStyle) — animé, il change à chaque pli. */
.maq-strip.is-right {
  left: auto;
  right: 0;
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}
</style>
