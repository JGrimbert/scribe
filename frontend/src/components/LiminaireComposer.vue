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

      <ol v-if="pages.length" class="pages">
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

      <p v-else class="empty">
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
import { computed, ref } from 'vue'
import AnalyseBlock from './analyse/AnalyseBlock.vue'
import BaseSelect from './ui/BaseSelect.vue'
import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY, PAGE_SIDES, deriveEligibility, entryPlainText } from '../script/liminaire'
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
