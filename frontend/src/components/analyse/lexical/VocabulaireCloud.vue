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
      <!-- En-tête (titre + choix du nombre de mots) : DASHBOARD SEULEMENT. En
           compact, le nombre de mots suit la largeur disponible et l'en-tête ne
           ferait que rogner la hauteur du nuage. -->
      <header v-if="!compact" class="cloud-head">
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
           filtres (ferrés bas). En mode `compact` il prend TOUTE la hauteur : les
           filtres passent en absolu par-dessus son bas (leur fond translucide les
           détache), et le nuage n'a plus à leur céder de place. Le wrapper
           non-compact est en `display:contents` pour ne pas casser le centrage. -->
      <!-- Catégorie imposée : son nom, ferré en tête. Les chips retirés, c'est la
           seule chose qui dise ce qu'on regarde. -->
      <p v-if="category" class="cloud-tag">{{ categoryLabel }}</p>

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
           items distincts de la catégorie · part des occurrences. ABSENTS quand
           l'hôte impose une catégorie (`category`) : c'est alors lui qui navigue —
           la scène de recherche le fait par ses mini-nuages. -->
      <div v-if="!category" class="cloud-foot">
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
// `width`/`height` : place disponible (px) — pilotent ENSEMBLE le nombre de mots
// par défaut (l'AIRE de la boîte, pas la seule largeur : le nuage compact vit dans
// une boîte haute, la largeur seule sous-estimait la place). 0 = non fourni.
// `dims` : gabarit du nuage (`{ width, height, verticalRatio }`) quand la boîte
// hôte n'a pas les proportions du volet — la maquette le pose désormais à côté des
// résultats, sur une boîte HAUTE (deux pages de large) et non plus dans le bandeau
// large et plat du dock. Lu au montage (comme le gabarit par défaut).
// `category` : catégorie IMPOSÉE par l'hôte (nom|personne|lieu|verbe|adj…). Le
// nuage n'en montre qu'elle et perd ses chips — la navigation d'une catégorie à
// l'autre appartient alors à l'hôte (la scène de recherche la confie à ses
// mini-nuages, cf. MiniCloud). Null = filtres cumulables du dashboard.
const props = defineProps({
  compact: Boolean,
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  dims: { type: Object, default: null },
  category: { type: String, default: null },
})

const { analysis, running, stepErrors, selectedLemma, settle } = useAnalyse()

const lexical = computed(() => analysis.value?.lexical ?? null)
const lemmas = computed(() => lexical.value?.lemmas ?? null)

// Nombre de mots affichés, réglable depuis l'en-tête (le backend en fournit
// jusqu'à 300). Le nuage se recompose quand la valeur change (via `words`).
const MAX_WORDS_OPTIONS = [40, 80, 120, 160, 200, 260]

// Défaut du nombre de mots selon la place dispo. Quand l'hôte fournit une hauteur,
// on se règle sur l'AIRE de la boîte (largeur × hauteur) : le nuage compact vit
// dans une boîte haute, la largeur seule sous-estimait la place. Repli sur la
// largeur seule (dashboard, sans hauteur). Tant que l'utilisateur n'a pas choisi à
// la main, le défaut suit la boîte.
function defaultMaxForBox(w, h) {
  if (h > 0) {
    const area = w * h
    if (area >= 340_000) return 260
    if (area >= 250_000) return 200
    if (area >= 175_000) return 160
    if (area >= 110_000) return 120
    if (area >= 60_000) return 80
    return 40
  }
  if (w >= 1400) return 200
  if (w >= 1200) return 160
  if (w >= 1000) return 120
  if (w >= 700) return 80
  return 40
}

const userPickedMax = ref(false)
const maxWords = ref(defaultMaxForBox(props.width, props.height))
watch(
  () => [props.width, props.height],
  ([w, h]) => { if (!userPickedMax.value) maxWords.value = defaultMaxForBox(w, h) },
)

function onPickMax(value) {
  userPickedMax.value = true
  maxWords.value = Number(value)
}

const { active, POS_FILTERS, ENTITY_FILTERS, filterStats, statLabel, words: allWords, filteredWords } =
  useCloudFilters(lexical)

// Catégorie imposée : elle court-circuite les chips (qui ne sont pas rendus).
const shownWords = computed(() => (
  props.category ? allWords.value.filter((w) => w.category === props.category) : filteredWords.value
))
const words = computed(() => shownWords.value.slice(0, maxWords.value))

// Libellé de la catégorie imposée, seule indication de ce que montre le nuage une
// fois les chips retirés. Puisé dans les mêmes listes qu'eux : un libellé recopié
// ici divergerait au premier renommage.
const categoryLabel = computed(() => (
  [...POS_FILTERS, ...ENTITY_FILTERS].find((f) => f.key === props.category)?.label ?? ''
))

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

/* ── Mode compact (volet de recherche, nuage de la maquette) ────────────────
   Pas d'en-tête : le nuage prend TOUTE la hauteur de sa boîte et les filtres se
   posent par-dessus son bas (absolus), d'où le `position: relative` ici. */
.cloud--compact {
  position: relative;
  height: 100%;
  gap: 0.1em;
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

/* Filtres posés EN ABSOLU au pied de la boîte, par-dessus le bas du nuage : ils ne
   lui prennent plus de hauteur. Bande de translucidité intermédiaire (moins
   transparente que le nuage) pour rester lisibles sur les mots qui passent dessous. */
.cloud--compact .cloud-foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  margin-top: 0;
  padding: 0.35em 0.5em;
  background: color-mix(in srgb, var(--c-bg) 60%, transparent);
  backdrop-filter: var(--c-backdrop-filter-blur);
}

/* Nom de la catégorie affichée : posé SUR le nuage (absolu) plutôt que dans le
   flux — en compact la boîte est étroite, une ligne de plus rognerait d'autant la
   hauteur du nuage. */
.cloud-tag {
  position: absolute;
  top: 0;
  left: 0.5em;
  margin: 0;
  z-index: 1;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink2);
  pointer-events: none;
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
