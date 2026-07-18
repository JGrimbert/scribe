<template>
  <!-- Split calqué sur le chapitrage : main = les pages du liminaire à typer,
       aside = le verdict d'éligibilité. Cadre effacé (bare), l'aside porte sa
       bordure. -->
  <AnalyseBlock aside="right" bare>
    <template #main>
      <table v-if="pages.length" class="pages">
        <thead>
          <tr>
            <th class="c-num">Page</th>
            <th class="c-odt" title="Côté imposé par le .odt d'origine">.odt</th>
            <th>Aperçu</th>
            <th>Type</th>
            <th>Côté</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in pages" :key="page.key">
            <td class="c-num">{{ page.ordinal + 1 }}</td>
            <td class="c-odt"><span class="side" :class="`side--${page.sideFromOdt}`">{{ sideGlyph(page.sideFromOdt) }}</span></td>
            <td class="preview" :title="page.preview">{{ page.preview || '—' }}</td>
            <td>
              <BaseSelect :model-value="typeOf(page)" @update:model-value="setType(page, $event)">
                <option value="">— non défini —</option>
                <option v-for="t in LIMINAIRE_PAGES" :key="t.key" :value="t.key">{{ t.label }}</option>
              </BaseSelect>
            </td>
            <td class="c-side">
              <BaseSelect :model-value="sideOf(page)" @update:model-value="setSide(page, $event)">
                <option v-for="s in PAGE_SIDES" :key="s" :value="s">{{ s }}</option>
              </BaseSelect>
              <span v-if="expectedSide(page)" class="expected" :class="{ conflict: conflicting(page) }">
                {{ expectedSide(page) }} attendu
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else class="empty">
        Aucune entrée liminaire. Si le liminaire de votre livre manque, reprenez les bornes ci-dessus —
        tout ce qui précède le début du contenu part ici.
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
          <p v-if="!elig.conflicts.length && !elig.duplicates.length" class="elig-ok">
            Aucun conflit.
          </p>
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
import { computed } from 'vue'
import AnalyseBlock from './analyse/AnalyseBlock.vue'
import BaseSelect from './ui/BaseSelect.vue'
import { LIMINAIRE_PAGES, LIMINAIRE_BY_KEY, PAGE_SIDES, deriveEligibility } from '../script/liminaire'

const props = defineProps({
  pages: { type: Array, required: true },
  // Muté EN PLACE (comme RuleSetForm mute son ruleSet) : le parent détient
  // l'objet réactif, keyé par `page.key`. Remonter chaque cellule par
  // `update:modelValue` recréerait l'objet à chaque frappe.
  config: { type: Object, required: true },
})

const elig = computed(() => deriveEligibility(props.pages, props.config))

function typeOf(page) {
  return props.config[page.key]?.type ?? ''
}

function sideOf(page) {
  return props.config[page.key]?.side ?? 'auto'
}

// Crée l'entrée réactive à la volée : une page qu'on n'a pas encore touchée n'a
// pas de clé dans la config.
function entryFor(page) {
  return (props.config[page.key] ??= {})
}

function setType(page, value) {
  entryFor(page).type = value || undefined
}

function setSide(page, value) {
  entryFor(page).side = value
}

// Le côté que la convention attend pour le type choisi (null si le type n'impose
// rien, ou si aucun type n'est posé).
function expectedSide(page) {
  const type = props.config[page.key]?.type
  return type ? (LIMINAIRE_BY_KEY.get(type)?.side ?? null) : null
}

function conflicting(page) {
  const expected = expectedSide(page)
  const chosen = sideOf(page)
  return !!expected && chosen !== 'auto' && chosen !== expected
}

function sideGlyph(side) {
  return side === 'recto' ? 'R' : side === 'verso' ? 'V' : '·'
}
</script>

<style scoped>
.pages {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}

.pages th {
  text-align: left;
  font-weight: 600;
  color: var(--c-ink2);
  padding: 0 var(--sp-2) var(--sp-2);
  border-bottom: 1px solid var(--c-border);
  white-space: nowrap;
}

.pages td {
  padding: var(--sp-2);
  border-bottom: 1px solid var(--c-border);
  vertical-align: middle;
}

.c-num {
  width: 3em;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: var(--c-ink2);
}

.c-odt {
  width: 3em;
  text-align: center;
}

/* Le côté imposé par le .odt : discret, informatif — pas une décision, un
   constat. */
.side {
  display: inline-block;
  min-width: 1.4em;
  padding: 0.05em 0.35em;
  border-radius: var(--radius-sm);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-ink2);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}

.side--recto { color: var(--c-accent); }
.side--verso { color: var(--c-ink2); }
.side--auto { opacity: var(--op-faint); border-style: dashed; }

.preview {
  max-width: 22em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
}

.c-side {
  white-space: nowrap;
}

.expected {
  margin-left: var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--c-ink2);
  opacity: var(--op-muted);
}

.expected.conflict {
  color: var(--c-danger);
  opacity: 1;
  font-weight: 600;
}

.empty {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

/* Aside : le verdict. Porte sa propre respiration (mode bare). */
.elig {
  padding: var(--split-pad-aside, var(--sp-4));
}

.elig-title {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-md);
  font-weight: 600;
}

.elig-group {
  margin-bottom: var(--sp-4);
}

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

.elig-list .pi {
  font-size: 0.85em;
}

.ok {
  color: var(--c-ink2);
}

.ok .pi {
  color: var(--c-accent);
}

.ko {
  color: var(--c-danger);
}

.elig-ok {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}
</style>
