<template>
  <UiCard bare>
    <UiNote v-if="stepErrors.lexical" variant="error">{{ stepErrors.lexical }}</UiNote>
    <UiNote v-if="!lexical">Analyse linguistique pas encore calculée pour ce document.</UiNote>
    <UiNote v-else-if="!lemmas">
      Nuage indisponible sur cette analyse — relancer l'analyse linguistique pour l'obtenir.
    </UiNote>

    <template v-else>
      <header class="cloud-head">
        <h3 class="cloud-title">
          Fréquence
          <i v-if="running === 'lexical'" class="pi pi-spin pi-spinner cloud-busy"></i>
        </h3>
        <label class="cloud-max">
          <span>Mots affichés</span>
          <BaseSelect :model-value="maxWords" @update:model-value="maxWords = Number($event)">
            <option v-for="n in MAX_WORDS_OPTIONS" :key="n" :value="n">{{ n }}</option>
          </BaseSelect>
        </label>
      </header>

      <!-- Le nuage occupe tout l'espace entre l'en-tête (ferré haut) et les
           filtres (ferrés bas), et s'y centre. -->
      <div class="cloud-body">
        <UiNote v-if="!filteredWords.length" variant="hint">
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
                :transform="`translate(${word.x}, ${word.y})`"
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
  </UiCard>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import cloud from 'd3-cloud'
import { forceSimulation, forceX, forceY } from 'd3-force'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import ChipGroup from '../ui/ChipGroup.vue'
import BaseChip from '../ui/BaseChip.vue'
import BaseSelect from '../ui/BaseSelect.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { formatInt } from '../../script/format'
import { loadLayout, saveLayout, signature } from '../../script/layoutCache'

const route = useRoute()
const { analysis, running, stepErrors, selectedLemma, settle } = useAnalyse()

// Le détail des occurrences est rendu à côté (OccurrencesCard) : on publie
// juste le lemme sélectionné dans l'état partagé.

// Nombre de mots affichés, réglable depuis l'en-tête (le backend en fournit
// jusqu'à 300). Le nuage se recompose quand la valeur change (via filteredWords).
const MAX_WORDS_OPTIONS = [40, 80, 120, 160, 200]
const maxWords = ref(80)
// Positions « maison » denses posées par d3-cloud.
const CLOUD_W = 760
const CLOUD_H = 440
const CLOUD_PADDING = 4
// Marge autour du layout : le viewBox est plus grand que la zone de placement
// d3-cloud, pour que les mots ne collent pas aux bords (le nuage respire).
const CLOUD_MARGIN = 48

// États exclusifs (jamais cumulés) : actif > survol > normal. Actif = maximum.
const SCALE_HOVER = 1.05
//const SCALE_ACTIVE = 1.1

// Dégradé par fréquence : mot rare (clair) → mot fréquent (teal profond).
const COLOR_LOW = '#aec4c7'
const COLOR_HIGH = '#0e7183'

// Repoussement UNIQUEMENT au clic : le mot cliqué pousse TOUT le nuage
// radialement, avec une intensité qui décroît avec la distance (diffusion
// douce). Chacun est ramené à sa position maison à la désélection.
const HOME_STRENGTH = 0.2
const REHEAT_DECAY = 0.04


const PUSH_STRENGTH = 8;
const PUSH_RANGE = 200;
const REHEAT_ALPHA = 0.7;
const VELOCITY_DECAY = 0.7;
const SCALE_ACTIVE = 1.05; // Grossissement plus discret


// Deux familles de filtres, sur deux lignes distinctes : natures grammaticales
// (issues des POS) puis entités nommées (Personnes/Lieux, source NER). Les noms
// propres (PROPN) ne sont plus un filtre à part : chacun est reclassé en
// « personne » ou « lieu » via les entités, un propre non typé retombant sur
// « personne » (cf. categoryOf).
const POS_FILTERS = [
  { key: 'nom', label: 'Noms' },
  { key: 'adj', label: 'Adjectifs' },
  { key: 'verbe', label: 'Verbes' },
  { key: 'adverbe', label: 'Adverbes' },
]
const ENTITY_FILTERS = [
  { key: 'personne', label: 'Personnes' },
  { key: 'lieu', label: 'Lieux' },
]
const ALL_FILTERS = [...POS_FILTERS, ...ENTITY_FILTERS]

// Catégorie ↔ POS (bijection pour les natures grammaticales).
const POS_TO_KEY = { NOUN: 'nom', ADJ: 'adj', VERB: 'verbe', ADV: 'adverbe' }
const KEY_TO_POS = { nom: 'NOUN', adj: 'ADJ', verbe: 'VERB', adverbe: 'ADV' }

// Reclassement des noms propres selon le type d'entité.
const ENTITY_LABEL_TO_KEY = { PER: 'personne', LOC: 'lieu' }
const ENTITY_KEY_TO_LABEL = { personne: 'PER', lieu: 'LOC' }
const ENTITY_PRIORITY = { personne: 0, lieu: 1 }

// Adverbes décochés par défaut : souvent peu porteurs de sens.
const active = reactive({ nom: true, personne: true, lieu: true, adj: true, verbe: true, adverbe: false })
const selected = ref(null)
const hovered = ref(null)

const lexical = computed(() => analysis.value?.lexical ?? null)
const lemmas = computed(() => lexical.value?.lemmas ?? null)

const posCounts = computed(() => lexical.value?.global?.posCounts ?? {})
// Dénominateur du pourcentage : tokens hors ponctuation/espaces (comme posCounts).
const totalTokens = computed(
  () => Object.values(posCounts.value).reduce((sum, c) => sum + c, 0) || 1,
)

// Index token(minuscule) → catégorie ('personne'|'lieu'), issu des entités NER.
// Un token présent dans plusieurs types garde le plus prioritaire (PER > LOC) —
// résout les ambigus (« Katia » présente en PER et MISC).
const entityIndex = computed(() => {
  const idx = new Map()
  for (const entity of lexical.value?.entities ?? []) {
    const key = ENTITY_LABEL_TO_KEY[entity.label]
    if (!key) continue
    for (const token of entity.text.toLowerCase().split(/\s+/)) {
      if (!token) continue
      const prev = idx.get(token)
      if (prev === undefined || ENTITY_PRIORITY[key] < ENTITY_PRIORITY[prev]) idx.set(token, key)
    }
  }
  return idx
})

// Catégorie d'un lemme : POS directe, sauf les noms propres reclassés via les
// entités (PER→personne, LOC→lieu ; sinon personne).
function categoryOf(lemma) {
  if (lemma.pos !== 'PROPN') return POS_TO_KEY[lemma.pos]
  return entityIndex.value.get(lemma.lemma.toLowerCase()) ?? 'personne'
}

// Items distincts de la catégorie · part de ses OCCURRENCES dans le texte
// (pas la part des lemmes : le % doit refléter le poids réel en occurrences).
function statLabel(s) {
  return `${formatInt(s.distinct)} · ${s.percent} %`
}

function pct(occ) {
  return ((occ / totalTokens.value) * 100).toFixed(1).replace('.', ',')
}

// Nombre de lemmes distincts par catégorie, compté sur la liste de lemmes (300
// max, hors stopwords) — toujours disponible, contrairement à `distinctByPos`
// (absent des analyses antérieures à son introduction).
const distinctByCategory = computed(() => {
  const acc = {}
  for (const lemma of lemmas.value ?? []) {
    const key = categoryOf(lemma)
    acc[key] = (acc[key] ?? 0) + 1
  }
  return acc
})

// Distinct = lemmes de la catégorie dans le nuage ; occurrences (donc %) depuis
// les sources complètes : posCounts pour les natures grammaticales, entités NER
// (PER/LOC) pour Personnes/Lieux.
function statFor(key) {
  const distinct = distinctByCategory.value[key] ?? 0
  const label = ENTITY_KEY_TO_LABEL[key]
  if (label) {
    let occ = 0
    for (const e of lexical.value?.entities ?? []) if (e.label === label) occ += e.count
    return { distinct, occ, percent: pct(occ) }
  }
  const occ = posCounts.value[KEY_TO_POS[key]] ?? 0
  return { distinct, occ, percent: pct(occ) }
}

const filterStats = computed(() =>
  Object.fromEntries(ALL_FILTERS.map((f) => [f.key, statFor(f.key)])),
)

// Lemmes déjà triés par fréquence décroissante côté backend (most_common) :
// on filtre par catégorie puis on garde le haut du panier.
const filteredWords = computed(() =>
  (lemmas.value ?? []).filter((lemma) => active[categoryOf(lemma)]).slice(0, maxWords.value),
)

const selectedEntry = computed(
  () => lemmas.value?.find((lemma) => lemma.lemma === selected.value) ?? null,
)

watch(selectedEntry, (entry) => { selectedLemma.value = entry }, { immediate: true })

function toggle(text) {
  selected.value = selected.value === text ? null : text
}

// Couleur = fréquence. Échelle en racine carrée (comme les positions maison) :
// sinon tout serait clair sauf le premier mot. RGB des bornes parsées une seule
// fois (pas à chaque frame comme avant).
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const RGB_LOW = hexToRgb(COLOR_LOW)
const RGB_HIGH = hexToRgb(COLOR_HIGH)

// Couleur d'un mot, calculée UNE fois par layout (stockée sur le nœud) : la
// fréquence ne change pas pendant l'animation, inutile de la recalculer à chaque
// tick de la simulation pour chaque mot.
function wordColor(count, maxCount) {
  const t = Math.sqrt(count) / Math.sqrt(maxCount)
  const c = RGB_LOW.map((v, i) => Math.round(v + (RGB_HIGH[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

// Un seul état par mot (actif > survol > normal), jamais cumulé. Ne fait plus
// aucun calcul de couleur : elle est pré-mémoïsée sur le nœud (word.color).
function wordStyle(word) {
  const isActive = word.text === selected.value
  const grow = isActive ? SCALE_ACTIVE : word.text === hovered.value ? SCALE_HOVER : 1
  return {
    fontSize: `${word.size * grow}px`,
    fontWeight: isActive ? 700 : 400,
    fill: word.color,
  }
}

// Force radiale : le mot cliqué repousse tous les autres, intensité décroissant
// avec la distance (diffusion douce à tout le nuage).
function radialPush() {
  let nodes = []
  function force(alpha) {
    const src = selected.value ? nodes.find((n) => n.text === selected.value) : null
    if (!src) return
    for (const n of nodes) {
      if (n === src) continue
      const dx = n.x - src.x
      const dy = n.y - src.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (PUSH_STRENGTH * PUSH_RANGE) / (d + PUSH_RANGE) * alpha
      n.vx += (dx / d) * f
      n.vy += (dy / d) * f
    }
  }
  force.initialize = (n) => { nodes = n }
  return force
}

// ── Positions « maison » (d3-cloud) + repoussement au clic (d3-force) ──

// PRNG déterministe (mulberry32) : même vocabulaire → mêmes positions maison.
function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let sim = null
let simNodes = []
const placed = ref([])

function stopSim() {
  sim?.stop()
  sim = null
}
onUnmounted(stopSim)

function buildFromLayout(out) {
  const maxCount = out.reduce((m, w) => Math.max(m, w.count), 1)
  simNodes = out.map((w) => ({
    text: w.text,
    count: w.count,
    size: w.size,
    color: wordColor(w.count, maxCount),
    hx: w.x, hy: w.y,
    x: w.x, y: w.y,
  }))

  sim = forceSimulation(simNodes)
      .velocityDecay(VELOCITY_DECAY)
      .force('x', forceX((d) => d.hx).strength(HOME_STRENGTH))
      .force('y', forceY((d) => d.hy).strength(HOME_STRENGTH))
      .force('radial', radialPush())
      .stop()

  placed.value = simNodes.slice()
  sim.on('tick', () => { placed.value = simNodes.slice() })

  // Sélection du mot le plus fréquent
  const top = out.reduce((m, w) => (w.count > m.count ? w : m), out[0])
  selected.value = top?.text ?? null

  // Déclenche le repoussement radial à l'initialisation (animation de
  // sélection du mot le plus fréquent), y compris depuis un layout caché.
  if (sim && selected.value) {
    sim.alpha(REHEAT_ALPHA).alphaDecay(REHEAT_DECAY).restart()
  }

  // Entrée du nuage jouée → la card suivante peut apparaître.
  settle('cloud')
}

// Police : plancher + amplitude (sqrt de la fréquence). L'échelle globale est
// ajustée pour que TOUS les mots tiennent dans la zone (cf. placeCloud).
const FONT_MIN = 14
const FONT_RANGE = 40
const FIT_SHRINK = 0.9
const FIT_MIN_SCALE = 0.35

const placeCloud = (words, sig, scale) => {
  // Première estimation : moins de place par mot quand il y en a plus (évite la
  // plupart des rejets dès le premier essai).
  if (scale === undefined) scale = Math.min(1, Math.sqrt(90 / words.length))
  const maxSqrt = Math.sqrt(words[0].count)
  cloud()
    .size([CLOUD_W, CLOUD_H])
    .words(words.map((w) => ({
      text: w.lemma,
      count: w.count,
      size: Math.max(6, Math.round((FONT_MIN + (Math.sqrt(w.count) / maxSqrt) * FONT_RANGE) * scale)),
    })))
    .spiral('archimedean')
    .padding(CLOUD_PADDING)
    .rotate(() => 0)
    .font('Georgia')
    .fontSize((d) => d.size)
    .random(mulberry32(1234))
    .on('end', (out) => {
      // d3-cloud abandonne silencieusement les mots qui ne rentrent pas : s'il
      // en manque, on rétrécit la police et on rejoue jusqu'à ce que tout tienne
      // (ou qu'on atteigne le plancher d'échelle).
      if (out.length < words.length && scale > FIT_MIN_SCALE) {
        placeCloud(words, sig, scale * FIT_SHRINK)
        return
      }
      // On ne persiste que les champs relus par buildFromLayout (positions
      // « maison » + métrique), pas les objets d3-cloud complets.
      const data = out.map((w) => ({ text: w.text, count: w.count, size: w.size, x: w.x, y: w.y }))
      saveLayout('cloud', route.params.id, sig, data)
      buildFromLayout(data)
    })
    .start()
}

// Signature du contenu d'entrée : mêmes lemmes/comptes/ordre + mêmes
// dimensions → même layout, donc cache réutilisable.
function cloudSignature(words) {
  return signature(
    words.map((w) => `${w.lemma}:${w.count}`).join('|') + `|${CLOUD_W}x${CLOUD_H}|${maxWords.value}`,
  )
}

watch(
  filteredWords,
  (words) => {
    stopSim()
    if (!words.length) {
      simNodes = []
      placed.value = []
      settle('cloud')
      return
    }
    const sig = cloudSignature(words)
    const cached = loadLayout('cloud', route.params.id, sig)
    if (cached) buildFromLayout(cached)
    else placeCloud(words, sig)
  },
  { immediate: true },
)

// Seul le CLIC (sélection) déclenche le repoussement.
watch(selected, () => {
  if (!sim) return
  sim.alpha(REHEAT_ALPHA).alphaDecay(REHEAT_DECAY).restart()
})
</script>

<style scoped>
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
  font-family: var(--font-serif);
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
