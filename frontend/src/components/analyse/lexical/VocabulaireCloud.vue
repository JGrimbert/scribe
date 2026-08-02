<template>
  <div class="cloud" :class="{ 'cloud--compact': compact }">
    <UiNote v-if="stepErrors.lexical" variant="error">{{ stepErrors.lexical }}</UiNote>
    <UiNote v-if="!lexical && running === 'lexical'" variant="hint">
      <i class="pi pi-spin pi-spinner"></i> Analyse linguistique en cours…
    </UiNote>
    <UiNote v-else-if="!lexical">Analyse linguistique pas encore calculée pour ce document.</UiNote>
    <UiNote v-else-if="!lemmas">
      Nuage indisponible sur cette analyse — relancer l'analyse linguistique pour l'obtenir.
    </UiNote>

    <template v-else>
      <header class="cloud-head">
        <h3 class="cloud-title">
          <i v-if="running === 'lexical'" class="pi pi-spin pi-spinner cloud-busy"></i>
        </h3>
        <label class="cloud-max">
          <span>Mots affichés</span>
          <BaseSelect :model-value="maxWords" @update:model-value="onPickMax">
            <option v-for="n in MAX_WORDS_OPTIONS" :key="n" :value="n">{{ n }}</option>
          </BaseSelect>
        </label>
      </header>

      <!-- Le nuage occupe tout l'espace entre l'en-tête (ferré haut) et les
           filtres (ferrés bas). En mode `compact` (volet de recherche), la zone
           défile via CustomScrollbar et les filtres restent épinglés en bas ;
           sinon le nuage s'y centre simplement (dashboard). Le wrapper non-compact
           est en `display:contents` pour ne pas casser ce centrage. -->
      <div class="cloud-body">
        <component :is="compact ? CustomScrollbar : 'div'" :class="compact ? 'cloud-scroll' : 'cloud-scroll--flat'">
          <UiNote v-if="!words.length" variant="hint">
            Aucun mot pour cette sélection de natures grammaticales.
          </UiNote>

          <svg
              v-else
              class="vocab-cloud"
              :viewBox="`0 0 ${CLOUD_W + CLOUD_MARGIN * 2} ${CLOUD_H + CLOUD_MARGIN * 2}`"
              role="img"
              aria-label="Nuage des lemmes les plus fréquents"
          >
            <g :transform="`translate(${CLOUD_W / 2 + CLOUD_MARGIN}, ${CLOUD_H / 2 + CLOUD_MARGIN})`">
              <text
                  v-for="word in placed"
                  :key="word.text"
                  class="cloud-word"
                  :transform="`translate(${word.x}, ${word.y}) rotate(${word.rotate || 0})`"
                  :style="wordStyle(word)"
                  @mouseenter="hovered = word.text"
                  @mouseleave="hovered = null"
                  @click="toggle(word.text)"
              >
                {{ word.text }}
                <title>{{ word.text }} — {{ word.count }} occurrence{{ word.count > 1 ? 's' : '' }}</title>
              </text>
            </g>
          </svg>
        </component>
      </div>

      <!-- Filtres ferrés en bas du bloc, sur deux lignes : natures grammaticales
           puis entités (Personnes/Lieux, distinguées en teal). Chaque chip :
           items distincts de la catégorie · part des occurrences. -->
      <div class="cloud-foot">
        <ChipGroup>
          <BaseChip
              v-for="filter in POS_FILTERS"
              :key="filter.key"
              :active="active[filter.key]"
              @click="active[filter.key] = !active[filter.key]"
          >
            {{ filter.label }}
            <span class="chip-stats">{{ statLabel(filterStats[filter.key]) }}</span>
          </BaseChip>
        </ChipGroup>
        <ChipGroup class="entity-filters">
          <BaseChip
              v-for="filter in ENTITY_FILTERS"
              :key="filter.key"
              :active="active[filter.key]"
              @click="active[filter.key] = !active[filter.key]"
          >
            {{ filter.label }}
            <span class="chip-stats">{{ statLabel(filterStats[filter.key]) }}</span>
          </BaseChip>
        </ChipGroup>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import UiNote from '../../ui/molecules/UiNote.vue'
import ChipGroup from '../../ui/molecules/ChipGroup.vue'
import BaseChip from '../../ui/atoms/BaseChip.vue'
import BaseSelect from '../../ui/atoms/BaseSelect.vue'
import CustomScrollbar from '../../ui/atoms/CustomScrollbar.vue'
import { useAnalyse } from '../../../composables/useAnalyse'
import { useCloudFilters } from '../../../composables/useCloudFilters'
import { useWordCloud } from '../../../composables/useWordCloud'

// `compact` : rendu resserré du volet de recherche (hauteur bornée, zone du
// nuage défilante, filtres épinglés en bas). Défaut = rendu dashboard.
// `width` : largeur disponible (px) — pilote le nombre de mots par défaut
// (plus l'input de recherche est large, plus on en montre). 0 = non fourni.
// `dims` : gabarit du nuage (`{ width, height, verticalRatio }`) quand la boîte
// hôte n'a pas les proportions du volet — la maquette le pose désormais à côté des
// résultats, sur une boîte HAUTE (deux pages de large) et non plus dans le bandeau
// large et plat du dock. Lu au montage (comme le gabarit par défaut).
const props = defineProps({
  compact: Boolean,
  width: { type: Number, default: 0 },
  dims: { type: Object, default: null },
})

const { analysis, running, stepErrors, selectedLemma, settle } = useAnalyse()

const lexical = computed(() => analysis.value?.lexical ?? null)
const lemmas = computed(() => lexical.value?.lemmas ?? null)

// Nombre de mots affichés, réglable depuis l'en-tête (le backend en fournit
// jusqu'à 300). Le nuage se recompose quand la valeur change (via `words`).
const MAX_WORDS_OPTIONS = [40, 80, 120, 160, 200]

// Défaut du nombre de mots selon la largeur dispo : ~120 dès 1000 px (largeur de
// l'input de recherche), moins en dessous. Tant que l'utilisateur n'a pas choisi
// à la main, le défaut suit la largeur.
function defaultMaxForWidth(w) {
  if (w >= 1400) return 200
  if (w >= 1200) return 160
  if (w >= 1000) return 120
  if (w >= 700) return 80
  return 40
}

const userPickedMax = ref(false)
const maxWords = ref(defaultMaxForWidth(props.width))
watch(
  () => props.width,
  (w) => { if (!userPickedMax.value) maxWords.value = defaultMaxForWidth(w) },
)

function onPickMax(value) {
  userPickedMax.value = true
  maxWords.value = Number(value)
}

const { active, POS_FILTERS, ENTITY_FILTERS, filterStats, statLabel, words: allWords, filteredWords } =
  useCloudFilters(lexical)

const words = computed(() => filteredWords.value.slice(0, maxWords.value))

// Volet de recherche : nuage large et plat (adapté au panneau court et large),
// au lieu du repère ~1,7:1 du dashboard. `verticalRatio` : un tiers des mots
// pivotés à 90°, pour occuper les couloirs qu'une composition tout-horizontale
// laisse vides dans un panneau étroit (carte du sommaire, en maquette).
const cloudDims = props.dims ?? (props.compact ? { width: 1040, height: 300, verticalRatio: 0.35 } : {})
const { placed, selected, hovered, toggle, wordStyle, CLOUD_W, CLOUD_H, CLOUD_MARGIN } =
  useWordCloud(words, () => settle('cloud'), cloudDims)

// Pont vers l'état partagé : le mot sélectionné dans le nuage pilote le détail
// des occurrences (OccurrencesCard) et la proximité (SemantiqueCard). Les mots
// (communs comme entités) portent { text, count, nodes } → forme attendue
// d'OccurrencesCard { lemma, count, nodes }.
const wordByText = computed(() => new Map(allWords.value.map((w) => [w.text, w])))
watch(
  selected,
  (text) => {
    const w = text ? wordByText.value.get(text) : null
    selectedLemma.value = w ? { lemma: w.text, count: w.count, nodes: w.nodes } : null
  },
  { immediate: true },
)
</script>

<style scoped>
/* Remplit la colonne : en-tête ferré haut, filtres ferrés bas, nuage au milieu. */
.cloud {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* En-tête du nuage : titre ferré en haut à gauche, réglage des mots à droite. */
.cloud-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1em;
}

.cloud-title {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--c-ink);
}

.cloud-busy {
  margin-left: 0.4em;
  font-size: 0.85em;
  color: var(--c-accent);
}

.cloud-max {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  font-size: var(--fs-sm);
  opacity: var(--op-muted);
}

/* Zone centrale : occupe tout l'espace entre l'en-tête et les filtres, le nuage
   s'y centre verticalement. min-height : plancher pour ne pas s'écraser quand la
   colonne de droite est courte. */
.cloud-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 18em;
}

/* Wrapper transparent en mode dashboard : ne génère pas de boîte, `.cloud-body`
   centre donc directement le nuage comme avant. */
.cloud-scroll--flat {
  display: contents;
}

/* ── Mode compact (volet de recherche) ──────────────────────────────────────
   Hauteur bornée : en-tête et filtres ferrés, la zone du nuage défile entre les
   deux (CustomScrollbar), paddings resserrés. */
.cloud--compact {
  height: 100%;
  gap: 0.1em;
}

/* En-tête resserré (juste le sélecteur « Mots affichés ») : on colle le nuage
   à la barre d'onglets. */
.cloud--compact .cloud-head {
  padding: 0 0.5em;
}

.cloud--compact .cloud-body {
  min-height: 0;
  display: block; /* la zone scrollable porte la hauteur, plus de centrage flex */
  padding: 0 0.5em;
}

.cloud--compact .cloud-scroll {
  height: 100%;
}

/* Le nuage tient dans la zone (SVG à hauteur pleine, mise à l'échelle « contain »
   centrée par le preserveAspectRatio par défaut) : plus de coupure nette en haut,
   le nuage se réduit pour rentrer plutôt que d'être rogné. */
.cloud--compact .vocab-cloud {
  height: 100%;
}

/* Filtres ferrés en bas, bord à bord : bande de translucidité intermédiaire
   (moins transparente que le nuage, plus que les onglets). */
.cloud--compact .cloud-foot {
  flex: 0 0 auto;
  margin-top: 0.3em;
  padding: 0.35em 0.5em;
  background: color-mix(in srgb, var(--c-bg) 60%, transparent);
}

.vocab-cloud {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* Filtres ferrés en bas. */
.cloud-foot {
  margin-top: 0.5em;
}

.cloud-word {
  font-family: impact;
  text-anchor: middle;
  dominant-baseline: central;
  cursor: pointer;
  transition: font-size 0.3s ease, fill 0.3s ease;
}

/* Les trois nombres d'un chip (mots distincts · occurrences · part). */
.chip-stats {
  opacity: var(--op-muted);
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}

/* Filtres centrés sous le nuage. */
:deep(.chip-group__chips) {
  justify-content: center;
}

/* Deuxième ligne : entités nommées, distinguées en teal (couleur du nuage). */
.entity-filters {
  margin-top: var(--sp-2);
}

.entity-filters :deep(.base-chip):hover,
.entity-filters :deep(.base-chip--active) {
  border-color: var(--c-accent-alt);
  color: var(--c-accent-alt);
}
</style>
