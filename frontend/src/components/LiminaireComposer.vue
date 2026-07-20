<template>
  <!-- Split : main = les pages du liminaire (frontières éditables), aside = le
       verdict d'éligibilité. Cadre effacé (bare), l'aside porte sa bordure. -->
  <AnalyseBlock aside="right" bare>
    <template #main>
      <p class="hint">
        Le découpage vient du <code>.odt</code> mais ses sauts sont trompeurs : <strong>rattachez</strong> les
        bouts d'une même page (page de titre…), <strong>scindez</strong> là où un type change sans saut
        (mentions ‖ dédicace…). Les pages blanches (verso) donnent la parité.
      </p>

      <div v-if="pages.length" class="toolbar">
        <div class="view-toggle" role="tablist">
          <button
              v-for="v in VIEWS"
              :key="v.key"
              type="button"
              :class="{ active: view === v.key }"
              :title="v.hint"
              @click="view = v.key"
          >{{ v.label }}</button>
        </div>
        <span class="toolbar-sep"></span>
        <button
            class="suggest-all"
            type="button"
            :disabled="!suggestableCount"
            @click="applyAllSuggestions"
        >
          <i class="pi pi-bolt"></i>
          Suggérer les types<span v-if="suggestableCount"> ({{ suggestableCount }})</span>
        </button>
        <button
            class="suggest-all"
            type="button"
            :disabled="!unresolved.length || fetchingSemantic"
            title="Deviner par similarité sémantique (service NLP) les pages que les règles ne résolvent pas"
            @click="fetchSemantic"
        >
          <i class="pi" :class="fetchingSemantic ? 'pi-spin pi-spinner' : 'pi-sparkles'"></i>
          Deviner par le sens<span v-if="unresolved.length"> ({{ unresolved.length }})</span>
        </button>
        <span v-if="semanticError" class="sem-error">{{ semanticError }}</span>
      </div>

      <!-- PLANCHES : maquette d'imposition empilée, verso | recto en regard. -->
      <div v-if="pages.length && view === 'planches'" class="planches">
        <div class="spread-legend"><span>Verso</span><span>Recto</span></div>
        <div v-for="(spread, si) in spreads" :key="si" class="spread">
          <div
              v-for="(cell, ci) in [spread.left, spread.right]"
              :key="ci"
              class="folio-slot"
              :class="ci === 0 ? 'is-left' : 'is-right'"
          >
            <LiminaireFolio
                v-bind="folioBind(cell)"
                @update:type="setType(cell.page, $event)"
                @apply-suggestion="applySuggestion(cell.page)"
                @toggle-merge="toggleBreak(cell.page.key, 'joined')"
                @cycle-side="cycleSide(cell.page)"
            />
          </div>
        </div>
      </div>

      <!-- CHEMIN DE FER : les mêmes planches déroulées à l'horizontale (le terme
           métier du plan de planches d'un livre). Défilement confié à
           CustomScrollbar — pas de scrollbar native imbriquée. -->
      <div v-if="pages.length && view === 'chemin'" class="chemin">
        <div class="spread-legend spread-legend--chemin"><span>Verso</span><span>Recto</span></div>
        <CustomScrollbar class="chemin-scroll">
          <div class="chemin-row">
            <div v-for="(spread, si) in spreads" :key="si" class="spread spread--inline">
              <div
                  v-for="(cell, ci) in [spread.left, spread.right]"
                  :key="ci"
                  class="folio-slot"
                  :class="ci === 0 ? 'is-left' : 'is-right'"
              >
                <LiminaireFolio
                    v-bind="folioBind(cell)"
                    @update:type="setType(cell.page, $event)"
                    @apply-suggestion="applySuggestion(cell.page)"
                    @toggle-merge="toggleBreak(cell.page.key, 'joined')"
                    @cycle-side="cycleSide(cell.page)"
                />
              </div>
            </div>
          </div>
        </CustomScrollbar>
      </div>

      <!-- ACCORDÉON : les vis-à-vis se chevauchent en profondeur, seul celui qui
           a le focus est à pleine taille (les autres à 0.75 → un tiers plus
           petit). Navigation SOUS la scène uniquement (flèches + pastilles),
           puis une réglette qui situe le vis-à-vis dans le liminaire. -->
      <div v-if="pages.length && view === 'accordeon'" class="accordeon">
        <div class="acc-stage">
          <div class="acc-backdrop" aria-hidden="true"></div>
          <div
              v-for="(spread, si) in spreads"
              :key="si"
              class="acc-spread"
              :class="{ 'is-focused': si === focused }"
              :style="accStyle(si)"
              @click="focused = si"
          >
            <!-- La mention ne coiffe QUE le vis-à-vis au premier plan, chaque
                 mot centré sur sa page. Hors flux (bottom: 100%) : elle ne
                 pousse pas les folios, sinon le focus se décalerait des autres. -->
            <div v-if="si === focused" class="acc-legend" aria-hidden="true">
              <span>Verso</span><span>Recto</span>
            </div>
            <div class="spread">
              <div
                  v-for="(cell, ci) in [spread.left, spread.right]"
                  :key="ci"
                  class="folio-slot"
                  :class="ci === 0 ? 'is-left' : 'is-right'"
              >
                <LiminaireFolio v-bind="folioBind(cell)" compact />
              </div>
            </div>
          </div>
        </div>

        <!-- La réglette AU-DESSUS de la zone d'inputs : elle ferme la scène, et
             c'est elle qui coupe le halo radial (centré juste dessous). -->
        <div class="acc-rail" title="Situation dans le liminaire" @click="scrubTo">
          <div class="acc-rail-thumb" :style="railThumbStyle"></div>
        </div>

        <!-- Entre les flèches : le(s) type(s) du vis-à-vis au premier plan. Un
             vis-à-vis peut porter DEUX pages taguables (mentions | dédicace). -->
        <div class="acc-nav">
          <button type="button" class="acc-arrow" title="Vis-à-vis précédent" :disabled="focused === 0" @click="focused--">
            <i class="pi pi-chevron-left"></i>
          </button>

          <div class="acc-controls">
            <div v-for="ctl in focusedControls" :key="ctl.side" class="acc-control">
              <!-- Slot inerte (blanche / couverture) : même gabarit, même liseré,
                   pour que la barre garde exactement la même largeur. -->
              <span v-if="ctl.kind === 'inert'" class="acc-inert">{{ ctl.label }}</span>
              <BaseSelect
                  v-else
                  class="acc-select"
                  :class="{ 'has-suggestion': ctl.pending }"
                  :title="ctl.pending ? ctl.pending.why : ''"
                  :model-value="ctl.type"
                  @update:model-value="setType(ctl.page, $event)"
              >
                <!-- UNE SEULE ligne porte la suggestion : la ligne courante (le
                     placeholder), lisible au repos. La liste ne la répète pas —
                     le type y garde son libellé nu, seulement mis en couleur
                     pour qu'on voie où cliquer pour l'appliquer. -->
                <option value="">{{ ctl.pending ? `${suggestGlyph(ctl.pending)} ${labelOf(ctl.pending.key)} ?` : '— type —' }}</option>
                <option
                    v-for="t in LIMINAIRE_PAGES"
                    :key="t.key"
                    :value="t.key"
                    :class="{ 'opt-suggest': ctl.pending && ctl.pending.key === t.key }"
                >{{ t.label }}</option>
              </BaseSelect>
            </div>
          </div>

          <button type="button" class="acc-arrow" title="Vis-à-vis suivant" :disabled="focused >= spreads.length - 1" @click="focused++">
            <i class="pi pi-chevron-right"></i>
          </button>
        </div>
      </div>

      <ol v-if="pages.length && view === 'liste'" class="pages">
        <li v-for="page in pages" :key="page.key" class="page" :class="{ 'page--blank': page.isBlank }">
          <div class="page-head">
            <span class="pnum">{{ page.ordinal + 1 }}</span>
            <span class="side" :class="`side--${page.sideFromOdt}`" title="Côté imposé par le .odt">{{ sideGlyph(page.sideFromOdt) }}</span>

            <template v-if="page.isBlank">
              <span class="blank-label">page blanche</span>
            </template>
            <template v-else>
              <BaseSelect class="type" :model-value="typeOf(page)" @update:model-value="setType(page, $event)">
                <option value="">— type non défini —</option>
                <option v-for="t in LIMINAIRE_PAGES" :key="t.key" :value="t.key">{{ t.label }}</option>
              </BaseSelect>
              <BaseSelect class="pside" :model-value="sideOf(page)" @update:model-value="setSide(page, $event)">
                <option v-for="s in PAGE_SIDES" :key="s" :value="s">{{ s }}</option>
              </BaseSelect>
              <span v-if="expectedSide(page)" class="expected" :class="{ conflict: conflicting(page) }">{{ expectedSide(page) }} attendu</span>
              <button
                  v-if="!typeOf(page) && suggestionFor(page)"
                  class="suggest"
                  :class="`suggest--${suggestionFor(page).source}`"
                  type="button"
                  :title="suggestionFor(page).why"
                  @click="applySuggestion(page)"
              >
                <i class="pi" :class="suggestionFor(page).source === 'flou' ? 'pi-sparkles' : 'pi-bolt'"></i>
                <span v-if="suggestionFor(page).source === 'flou'">≈ </span>{{ labelOf(suggestionFor(page).key) }} ?
              </button>
            </template>

            <button
                v-if="page.ordinal > 0"
                class="op"
                :class="{ 'op--active': breakOf(page.key) === 'joined' }"
                type="button"
                title="Rattacher cette page à la précédente"
                @click="toggleBreak(page.key, 'joined')"
            >
              <i class="pi pi-arrow-up"></i> rattacher
            </button>
          </div>

          <ul class="entries">
            <li v-for="(entry, ei) in page.entries" :key="entry.key" class="entry">
              <button
                  v-if="ei > 0"
                  class="op op--split"
                  :class="{ 'op--active': breakOf(entry.key) === 'start' }"
                  type="button"
                  title="Démarrer une nouvelle page ici"
                  @click="toggleBreak(entry.key, 'start')"
              >
                <i class="pi pi-arrow-down"></i> scinder ici
              </button>
              <span class="etext" :class="{ 'etext--empty': entry.isBlank }">{{ entryPlainText(entry) || '(vide)' }}</span>
            </li>
          </ul>
        </li>
      </ol>

      <p v-if="!pages.length" class="empty">
        Aucune entrée liminaire. Si le liminaire de votre livre manque, reprenez les bornes ci-dessus.
      </p>
    </template>

    <template #aside>
      <div class="elig">
        <h4 class="elig-title">Éligibilité</h4>

        <div class="elig-group">
          <span class="elig-label">Pages obligatoires</span>
          <ul class="elig-list">
            <li v-for="o in elig.obligatoires" :key="o.key" :class="o.present ? 'ok' : 'ko'">
              <i class="pi" :class="o.present ? 'pi-check' : 'pi-times'"></i>
              {{ o.label }}
            </li>
          </ul>
        </div>

        <div class="elig-group">
          <span class="elig-label">Composition recto-verso</span>
          <p v-if="!elig.conflicts.length && !elig.duplicates.length" class="elig-ok">Aucun conflit.</p>
          <ul v-else class="elig-list">
            <li v-for="c in elig.conflicts" :key="`c-${c.key}`" class="ko">
              <i class="pi pi-exclamation-triangle"></i>
              {{ c.label }} : {{ c.chosen }} choisi, {{ c.expected }} attendu
            </li>
            <li v-for="d in elig.duplicates" :key="`d-${d.type}`" class="ko">
              <i class="pi pi-exclamation-triangle"></i>
              {{ d.label }} en {{ d.count }} exemplaires
            </li>
          </ul>
        </div>
      </div>
    </template>
  </AnalyseBlock>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AnalyseBlock from './analyse/AnalyseBlock.vue'
import BaseSelect from './ui/BaseSelect.vue'
import CustomScrollbar from './CustomScrollbar.vue'
import LiminaireFolio from './LiminaireFolio.vue'
import {
  LIMINAIRE_PAGES,
  LIMINAIRE_BY_KEY,
  PAGE_SIDES,
  deriveEligibility,
  entryPlainText,
  computeImposition,
  toSpreads,
} from '../script/liminaire'
import { suggestAll } from '../script/liminaire-suggest'

const props = defineProps({
  pages: { type: Array, required: true },
  // Muté EN PLACE (comme RuleSetForm) : le parent détient l'objet réactif, keyé
  // par ENTRÉE. `type`/`side` = tag de la page ancrée ; `break` = frontière.
  config: { type: Object, required: true },
  // Titre du livre : départage faux-titre (titre seul) et page de titre.
  title: { type: String, default: '' },
})

const elig = computed(() => deriveEligibility(props.pages, props.config))

// Quatre vues du même modèle. La scission se fait dans la LISTE — une planche
// est une page, pas ses entrées ; les trois autres composent le vis-à-vis.
const VIEWS = [
  { key: 'planches', label: 'Planches', hint: 'Les vis-à-vis empilés verticalement' },
  { key: 'liste', label: 'Liste', hint: 'Le détail des entrées — pour scinder une page' },
  { key: 'chemin', label: 'Chemin de fer', hint: 'Les vis-à-vis déroulés à l’horizontale' },
  { key: 'accordeon', label: 'Accordéon', hint: 'Les vis-à-vis en profondeur, un seul au premier plan' },
]
const view = ref('planches')

// Folios physiques (avec blanches implicites de parité) regroupés en planches.
// Chaque page reçoit son côté choisi ET la convention de son type (l'ancre de
// parité), cf. effectiveSide.
const spreads = computed(() =>
  toSpreads(
    computeImposition(
      props.pages.map((p) => ({
        ...p,
        side: sideOf(p),
        typeSide: LIMINAIRE_BY_KEY.get(typeOf(p))?.side ?? 'auto',
      })),
    ),
  ),
)

// Les props d'un folio, dérivées d'un slot d'imposition. Un slot blanc, une
// couverture ou un vis-à-vis vide n'ont pas de page à taguer.
function folioBind(cell) {
  if (!cell || cell.blank || cell.cover) return { cell }
  return {
    cell,
    type: typeOf(cell.page),
    suggestion: suggestionFor(cell.page),
    side: sideOf(cell.page),
    joined: breakOf(cell.page.key) === 'joined',
  }
}

// ─── Accordéon : le vis-à-vis au premier plan ────────────────────────────────
const focused = ref(0)

// Les frontières bougent (fusion/scission) → le focus peut sortir de la liste.
watch(
  () => spreads.value.length,
  (n) => {
    if (focused.value > n - 1) focused.value = Math.max(0, n - 1)
  },
)

// Les vis-à-vis s'ÉTALENT sur toute la largeur : le i-ème est ancré à i/(n-1)
// de la largeur et retranché d'autant de sa propre largeur — le premier colle à
// gauche, le dernier à droite, les autres s'égrènent entre les deux. Le
// chevauchement naît de ce que la largeur d'un vis-à-vis excède son pas.
// Aucun recentrage sur le focus : sélectionner ne déplace rien, ça ZOOME sur
// place (origine centrale). Aucune opacité non plus — les pages restent pleines,
// seule l'échelle et la profondeur les distinguent.
// Chaque cran d'éloignement DESCEND le vis-à-vis : l'escalier sépare des pages
// qui, alignées, se confondraient sous le chevauchement.
const ACC_DROP = 11

function accStyle(i) {
  const n = spreads.value.length
  const t = n > 1 ? i / (n - 1) : 0.5
  const dist = Math.abs(i - focused.value)
  const scale = i === focused.value ? 1 : 0.75
  return {
    left: `${t * 100}%`,
    transform: `translateX(-${t * 100}%) translateY(${dist * ACC_DROP}px) scale(${scale})`,
    zIndex: String(n - dist),
  }
}

// Les pages taguables du vis-à-vis au premier plan — jusqu'à DEUX (le verso et
// le recto peuvent porter chacun un type : mentions | dédicace).
// TOUJOURS deux entrées (verso puis recto), même quand une seule est taguable :
// une page blanche ou la couverture rend un bloc inerte de même gabarit. Sans
// lui, la barre se rétrécirait et LES FLÈCHES BOUGERAIENT d'un vis-à-vis à
// l'autre — le flux doit rester absolument fixe.
const focusedControls = computed(() => {
  const sp = spreads.value[focused.value]
  if (!sp) return []
  return [
    { cell: sp.left, side: 'verso' },
    { cell: sp.right, side: 'recto' },
  ].map(({ cell, side }) => {
    if (!cell || cell.cover) return { side, kind: 'inert', label: 'Page de garde' }
    if (cell.blank) return { side, kind: 'inert', label: 'Page blanche' }
    const type = typeOf(cell.page)
    return {
      side,
      kind: 'page',
      key: cell.page.key,
      page: cell.page,
      type,
      // `pending` = une suggestion NON encore décidée. Un type déjà posé
      // referme la question : le select redevient un select ordinaire.
      pending: type ? null : suggestionFor(cell.page),
    }
  })
})

// Un <option> natif ne peut pas porter d'icône de police : on prend un glyphe.
// Même code que l'indice inline — ⚡ déduit (sûr), ≈ deviné (flou).
function suggestGlyph(suggestion) {
  return suggestion?.source === 'flou' ? '≈' : '⚡'
}

// Réglette : le pouce occupe 1/N et se place sur le vis-à-vis courant — il
// matérialise « où on en est » dans le liminaire, sans être un vrai scroll.
const railThumbStyle = computed(() => {
  const n = Math.max(1, spreads.value.length)
  return { width: `${100 / n}%`, left: `${(focused.value / n) * 100}%` }
})

function scrubTo(event) {
  const rail = event.currentTarget
  const ratio = (event.clientX - rail.getBoundingClientRect().left) / rail.clientWidth
  const n = spreads.value.length
  focused.value = Math.min(n - 1, Math.max(0, Math.floor(ratio * n)))
}

// Cycle auto → recto → verso → auto (contrôle compact sur la planche).
function cycleSide(page) {
  const order = ['auto', 'recto', 'verso']
  setSide(page, order[(order.indexOf(sideOf(page)) + 1) % 3])
}

// Suggestions DÉTERMINISTES (style-name + mots-clés + titre), instantanées. Une
// proposition, pas une décision : rien n'est persisté tant que l'utilisateur ne
// l'applique pas (même philosophie que la typologie des styles).
const deterministic = computed(() => suggestAll(props.pages, { title: props.title }))

// Suggestions SÉMANTIQUES (NLP), remplies à la demande par fetchSemantic().
// { [pageKey]: { type, score } }.
const semantic = ref({})
const fetchingSemantic = ref(false)
const semanticError = ref(null)

// Pages non taguées que le déterministe RÉSOUT (compteur du bouton d'application).
const suggestableCount = computed(
  () => props.pages.filter((p) => !typeOf(p) && deterministic.value[p.key]).length,
)

// Pages non taguées que le déterministe NE résout PAS — candidates au NLP.
const unresolved = computed(
  () => props.pages.filter((p) => !p.isBlank && !typeOf(p) && !deterministic.value[p.key]),
)

// Fusion : le déterministe l'emporte (sûr), le sémantique complète (flou). La
// `source` distingue les deux à l'affichage.
function suggestionFor(page) {
  const det = deterministic.value[page.key]
  if (det) return { key: det.key, why: det.why, source: 'sur' }
  const sem = semantic.value[page.key]
  if (sem) return { key: sem.type, why: `proche sémantiquement (${Math.round(sem.score * 100)} %)`, source: 'flou' }
  return null
}

function labelOf(key) {
  return LIMINAIRE_BY_KEY.get(key)?.label ?? key
}

function applySuggestion(page) {
  const s = suggestionFor(page)
  if (s) setType(page, s.key)
}

// N'applique QUE le déterministe (haute confiance). Le sémantique reste cliquable
// page par page — un flou se valide, il ne s'impose pas en masse.
function applyAllSuggestions() {
  for (const page of props.pages) {
    if (!typeOf(page) && deterministic.value[page.key]) setType(page, deterministic.value[page.key].key)
  }
}

async function fetchSemantic() {
  fetchingSemantic.value = true
  semanticError.value = null
  try {
    const pages = unresolved.value.map((p) => ({ key: p.key, text: p.entries.map(entryPlainText).join(' ') }))
    const res = await fetch('/api/analyse/liminaire-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.message || `HTTP ${res.status}`)
    }
    semantic.value = { ...semantic.value, ...(await res.json()) }
  } catch (e) {
    semanticError.value = `Suggestion sémantique indisponible : ${e.message}`
  } finally {
    fetchingSemantic.value = false
  }
}

function typeOf(page) {
  return props.config[page.key]?.type ?? ''
}

function sideOf(page) {
  return props.config[page.key]?.side ?? 'auto'
}

function breakOf(key) {
  return props.config[key]?.break
}

function entryFor(key) {
  return (props.config[key] ??= {})
}

function setType(page, value) {
  entryFor(page.key).type = value || undefined
}

function setSide(page, value) {
  entryFor(page.key).side = value === 'auto' ? undefined : value
}

// Toggle : re-cliquer une frontière posée la retire (retour au signal du .odt).
// On nettoie l'entrée devenue vide pour ne pas laisser d'objet mort.
function toggleBreak(key, value) {
  const entry = entryFor(key)
  if (entry.break === value) {
    delete entry.break
    if (!entry.type && !entry.side) delete props.config[key]
  } else {
    entry.break = value
  }
}

function expectedSide(page) {
  const type = props.config[page.key]?.type
  return type ? (LIMINAIRE_BY_KEY.get(type)?.side ?? null) : null
}

function conflicting(page) {
  const expected = expectedSide(page)
  return !!expected && sideOf(page) !== 'auto' && sideOf(page) !== expected
}

function sideGlyph(side) {
  return side === 'recto' ? 'R' : side === 'verso' ? 'V' : '·'
}
</script>

<style scoped>
.hint {
  margin: 0 0 var(--sp-3);
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.toolbar {
  margin-bottom: var(--sp-3);
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

.sem-error {
  color: var(--c-danger);
  font-size: var(--fs-sm);
}

.view-toggle {
  display: inline-flex;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.view-toggle button {
  border: 0;
  background: none;
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-sm);
  padding: 0.3em 0.8em;
  cursor: pointer;
}

.view-toggle button.active {
  background: var(--c-accent);
  color: #fff;
}

.toolbar-sep {
  width: 1px;
  align-self: stretch;
  background: var(--c-border);
  margin: 0 var(--sp-1);
}

/* ─── Planches : maquette d'imposition ─────────────────────────────────── */
.planches {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  align-items: center;
}

/* Une planche = un livre ouvert : deux folios se rejoignant au centre. */
.spread {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: min(100%, 30em);
}

.folio-slot {
  display: flex;
}

.folio-slot.is-left { justify-content: flex-end; }
.folio-slot.is-right { justify-content: flex-start; }

/* Le folio : un rectangle de page, ratio ~A5 portrait. */
.folio {
  position: relative;
  width: 100%;
  max-width: 13em;
  aspect-ratio: 1 / 1.414;
  border: 1px solid var(--c-border);
  background: var(--c-surface0);
  border-radius: var(--radius-sm);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  padding: var(--sp-3) var(--sp-2) var(--sp-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  overflow: hidden;
}

/* La reliure : le bord intérieur (droite du verso, gauche du recto) plus marqué.
   Le folio est la racine d'un composant enfant → :deep() pour l'atteindre. */
.is-left :deep(.folio) { border-right-width: 2px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.is-right :deep(.folio) { border-left-width: 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; }

/* Qui est à gauche, qui est à droite : la question se pose à chaque coup d'œil.
   Mêmes colonnes que .spread pour tomber pile au-dessus des deux folios. */
.spread-legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: min(100%, 30em);
  font-size: var(--fs-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--c-ink2);
  opacity: var(--op-muted);
}

.spread-legend span:first-child { text-align: right; padding-right: var(--sp-2); }
.spread-legend span:last-child { padding-left: var(--sp-2); }

.suggest-all {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  color: inherit;
  font: inherit;
  font-size: var(--fs-sm);
  padding: 0.35em 0.8em;
  cursor: pointer;
}

.suggest-all:hover:not(:disabled) {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.suggest-all:disabled {
  opacity: var(--op-faint);
  cursor: default;
}

/* Indice inline : une proposition à un clic, en teinte d'accent discrète. */
.suggest {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  border: 1px dashed var(--c-accent);
  border-radius: 1em;
  background: none;
  color: var(--c-accent);
  font: inherit;
  font-size: var(--fs-xs);
  padding: 0.1em 0.6em;
  cursor: pointer;
  opacity: var(--op-muted);
}

.suggest:hover {
  opacity: 1;
}

/* Suggestion sémantique (floue) : ton distinct de l'accent (déterministe, sûr)
   pour que « deviné » ne se confonde pas avec « déduit ». */
.suggest--flou {
  border-color: var(--c-ink2);
  color: var(--c-ink2);
}

/* ─── Chemin de fer : les planches déroulées à l'horizontale ─────────────── */
.chemin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
}

/* Hauteur DÉFINIE, indépendante du contenu : CustomScrollbar mesure son
   conteneur, une hauteur « auto » ne lui donnerait rien à faire défiler. */
.chemin-scroll {
  width: 100%;
  height: 24em;
}

.chemin-row {
  display: flex;
  gap: var(--sp-4);
  width: max-content;
  padding-bottom: var(--sp-3);
}

/* En ligne, un vis-à-vis ne s'étire plus : il prend sa largeur propre. */
.spread--inline {
  width: 26em;
  flex: 0 0 auto;
}

.spread-legend--chemin { width: 26em; }

/* ─── Accordéon : les vis-à-vis en profondeur ────────────────────────────── */
.accordeon {
  display: flex;
  flex-direction: column;
}

.acc-stage {
  position: relative;
  /* Serrée au plus près des folios : la réglette suit immédiatement. Calée sur
     la hauteur du vis-à-vis au focus (le plus haut), à un cheveu près. */
  height: 21.5em;
  /* Coupe le halo net sur le bas de la scène — c'est-à-dire pile sur la
     réglette. */
  overflow: hidden;
}

/* Profondeur SANS gris : une ellipse TEINTÉE (accent), centrée sous la scène,
   qui monte derrière les pages et que la réglette tranche net.
   `saturate()` seul ne suffisait pas — sur un fond quasi neutre il n'a rien à
   amplifier, d'où l'effet quasi invisible. C'est la teinte qui porte l'effet,
   le filtre ne fait que la densifier. */
.acc-backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(
      ellipse 46% 75% at 50% 100%,
      color-mix(in srgb, var(--c-accent) 10%, transparent),
      color-mix(in srgb, var(--c-accent) 10%, transparent) 45%,
      transparent 72%
  );
  pointer-events: none;
}

.acc-spread {
  position: absolute;
  /* Laisse juste la place à la mention Verso/Recto, posée hors flux au-dessus. */
  top: 1.7em;
  width: 26em;
  cursor: pointer;
  /* Compositor-only. `left` ne dépend que du rang, seul `transform` est animé. */
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.acc-spread.is-focused {
  cursor: default;
  /* Ombre courte et pâle : elle doit décoller la page, pas la souligner — et
     rester dans la scène, qui la couperait si elle portait loin. */
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.12));
}

/* ZÉRO transparence sur le vis-à-vis au premier plan : c'est du papier, il doit
   être franc. Les atténuations (numéro de folio, type non posé, page blanche
   sans fond) laissaient l'ellipse transparaître au travers et le délavaient. */
.acc-spread.is-focused :deep(.folio),
.acc-spread.is-focused :deep(.folio *) {
  opacity: 1;
}

.acc-spread.is-focused :deep(.folio--blank) {
  background: var(--c-surface0);
}

/* Mention Verso | Recto : mêmes colonnes que .spread, donc chaque mot tombe
   centré sur SA page. Hors flux pour ne pas décaler les folios. */
.acc-legend {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: var(--sp-1);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  text-align: center;
  font-size: var(--fs-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  /* Sourde par la COULEUR, pas par l'opacité : rien ne doit être translucide
     sur le vis-à-vis au premier plan. */
  color: var(--c-ink2);
}

/* Réglette de situation : où l'on est dans le liminaire. Pas un vrai scroll —
   la navigation est par vis-à-vis, pas au pixel. Elle sépare la scène des
   contrôles, et borne le halo. */
.acc-rail {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: var(--c-border);
  cursor: pointer;
  margin-bottom: var(--sp-4);
}

.acc-rail-thumb {
  position: absolute;
  top: 0;
  height: 100%;
  min-width: 12px;
  border-radius: 3px;
  background: var(--c-accent);
  transition: left 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

/* Zone d'inputs, SOUS la réglette : flèche · type(s) · flèche. */
.acc-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
}

.acc-arrow {
  flex: 0 0 auto;
  width: 2em;
  height: 2em;
  border: 1px solid var(--c-border);
  border-radius: 50%;
  background: var(--c-surface);
  color: var(--c-ink2);
  font: inherit;
  cursor: pointer;
}

.acc-arrow:hover:not(:disabled) { border-color: var(--c-accent); color: var(--c-accent); }
.acc-arrow:disabled { opacity: var(--op-faint); cursor: default; }

.acc-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  min-height: 2em;
}

/* Gabarit FIXE : les deux slots font la même largeur quoi qu'ils contiennent,
   donc les flèches ne bougent jamais d'un vis-à-vis à l'autre. */
.acc-control {
  flex: 0 0 13em;
  display: flex;
}

.acc-select { width: 100%; }

/* Slot inerte : le liseré du select à l'identique (mêmes padding, bordure,
   rayon, taille) — mais discontinu et sourd, pour dire « rien à décider ici ». */
.acc-inert {
  width: 100%;
  padding: 0.35em 0.5em;
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-md);
  background: none;
  font-size: var(--fs-md);
  font-style: italic;
  color: var(--c-ink2);
  opacity: var(--op-muted);
  text-align: center;
}

/* Un type encore SUGGÉRÉ (non décidé) : le select reprend la signature de
   l'indice — trait discontinu et teinte d'accent — pour qu'on lise « proposé »
   et non « choisi ». La 1re ligne du menu applique la suggestion. */
.acc-select.has-suggestion {
  border-style: dashed;
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.acc-select .opt-suggest {
  color: var(--c-accent);
  font-weight: 600;
}


.pages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.page {
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: var(--sp-2) var(--sp-3);
}

/* Page blanche : structurante, pas du contenu — atténuée, en pointillés. */
.page--blank {
  border-style: dashed;
  opacity: var(--op-muted);
}

.page-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

.pnum {
  min-width: 1.6em;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-sm);
  color: var(--c-ink2);
}

.side {
  display: inline-block;
  min-width: 1.4em;
  text-align: center;
  padding: 0.05em 0.35em;
  border-radius: var(--radius-sm);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-ink2);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}

.side--recto { color: var(--c-accent); }
.side--auto { opacity: var(--op-faint); border-style: dashed; }

.blank-label {
  font-size: var(--fs-sm);
  font-style: italic;
  color: var(--c-ink2);
}

.type { min-width: 12em; }

.expected {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  opacity: var(--op-muted);
}

.expected.conflict {
  color: var(--c-danger);
  opacity: 1;
  font-weight: 600;
}

/* Opérations de frontière : discrètes, révélées à l'usage. */
.op {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  border: 1px solid var(--c-border);
  border-radius: 1em;
  background: none;
  color: var(--c-ink2);
  font: inherit;
  font-size: var(--fs-xs);
  padding: 0.1em 0.7em;
  cursor: pointer;
  opacity: var(--op-muted);
}

.op:hover { opacity: 1; }

.op--active {
  opacity: 1;
  color: var(--c-accent);
  border-color: var(--c-accent);
}

.op--split {
  margin-left: 0;
  flex: 0 0 auto;
}

.entries {
  list-style: none;
  margin: var(--sp-2) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.entry {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}

.etext {
  font-family: var(--font-serif);
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.etext--empty {
  font-style: italic;
  opacity: var(--op-faint);
}

.empty {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

/* Aside : le verdict. */
.elig { padding: var(--split-pad-aside, var(--sp-4)); }

.elig-title {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-md);
  font-weight: 600;
}

.elig-group { margin-bottom: var(--sp-4); }

.elig-label {
  display: block;
  font-size: var(--fs-sm);
  font-weight: 600;
  margin-bottom: var(--sp-2);
}

.elig-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  font-size: var(--fs-sm);
}

.elig-list li {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}

.elig-list .pi { font-size: 0.85em; }

.ok { color: var(--c-ink2); }
.ok .pi { color: var(--c-accent); }
.ko { color: var(--c-danger); }

.elig-ok {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}
</style>
