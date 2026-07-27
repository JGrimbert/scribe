<template>
  <!-- Mise en page : propriétés globales du livre, indépendantes des styles.
       Deux colonnes — le format de page (dimensions + marges miroir + aperçu
       recto/verso) d'un côté, les en-têtes/pieds et les styles généraux de
       l'autre. -->
  <section class="layout">
    <h3 class="section-title"><i class="pi pi-clone" aria-hidden="true"></i>Maquette</h3>
    <div class="cols">
    <!-- ── Colonne 1 : aperçu (au-dessus) + format de page ─────────────────── -->
    <div class="col col--first">
      <!-- L'aperçu recto/verso, hors du bloc et au-dessus : il illustre le format
           et les marges réglés juste en dessous. -->
      <PageDiagram
          class="figure"
          :page-size="diagramPageSize"
          :margins="diagramMargins"
          :running-titles="styleDefaults.runningTitles"
      />
      <div class="card">
        <h3 class="card-title"><i class="pi pi-file" aria-hidden="true"></i>Format de page</h3>
        <p class="card-hint">
          Dimensions et marges du livre. Le petit fond (intérieur, côté reliure) et le grand
          fond (extérieur) s'échangent entre recto et verso.
        </p>
        <PageFormatSection :page="page" :style-defaults="styleDefaults" />
      </div>
    </div>

    <!-- ── Colonne 2 : en-têtes/pieds + styles généraux ───────────────────── -->
    <div class="col">
      <div class="card">
        <h3 class="card-title"><i class="pi pi-window-minimize" aria-hidden="true"></i>En-têtes et pieds de page</h3>
        <p class="card-hint">
          Le titre du livre et le nom du chapitre courant ; par convention, le titre sur les
          pages paires et le chapitre sur les impaires.
        </p>

        <UiNote v-if="odtSuggestion" variant="hint" class="odt-note">
          Ce <code>.odt</code> déclarait déjà des en-têtes ou pieds.
          <button type="button" class="link-btn" @click="applyOdt">Reprendre du .odt</button>
        </UiNote>

        <div class="bands">
          <RunningBandControl :band="rt.header" label="En-tête" icon="pi-angle-up" />
          <RunningBandControl :band="rt.footer" label="Pied de page" icon="pi-angle-down" symmetric allow-folio />
        </div>

        <p class="folio-hint">
          Le numéro de page se choisit dans le contenu du pied. La numérotation continue
          viendra plus tard — l'aperçu affiche <code>?</code>.
        </p>
        <p class="rule-note">
          <i class="pi pi-info-circle" aria-hidden="true"></i>
          Jamais d'en-tête, de pied ni de numéro sur les pages liminaires, les premières pages
          de chapitre et les pages blanches — règle typographique appliquée d'office.
        </p>
      </div>

      <div class="card">
        <h3 class="card-title"><i class="pi pi-language" aria-hidden="true"></i>Styles généraux</h3>
        <p class="card-hint">
          Appliqués à tout le livre, par-dessus les styles du <code>.odt</code>. Un style qui
          fixe lui-même la valeur garde la sienne.
        </p>
        <label class="toggle">
          <input type="checkbox" v-model="styleDefaults.hyphenation.global" />
          <span class="toggle-body">
            <span class="toggle-name">Césure</span>
            <span class="toggle-desc">Coupe les mots longs en fin de ligne — resserre le texte justifié.</span>
          </span>
          <span class="toggle-state">{{ styleDefaults.hyphenation.global ? 'Activée' : 'Désactivée' }}</span>
        </label>
      </div>
    </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import PageFormatSection from './PageFormatSection.vue'
import PageDiagram from './PageDiagram.vue'
import RunningBandControl from './RunningBandControl.vue'
import UiNote from '../ui/molecules/UiNote.vue'
import { effectiveMargins, effectivePage, runningTitlesFromOdt } from '../../script/pageFormats'

// `styleDefaults` est muté en place (pageSize/pageMargins dans PageFormatSection,
// runningTitles ici et dans RunningBandControl), comme `styleRoles`/`ruleSet` : la
// map réactive est détenue par le composable de config.
const props = defineProps({
  page: { type: Object, default: null },
  styleDefaults: { type: Object, required: true },
})

const rt = computed(() => props.styleDefaults.runningTitles)

// Le diagramme reflète le format ET les marges EN COURS d'édition.
const diagramPageSize = computed(() => effectivePage(props.page, props.styleDefaults.pageSize))
const diagramMargins = computed(() => effectiveMargins(props.page, props.styleDefaults.pageMargins))

// Ce que le .odt portait déjà (null si rien) : bouton « Reprendre du .odt ».
const odtSuggestion = computed(() => runningTitlesFromOdt(props.page))

function applyOdt() {
  const s = odtSuggestion.value
  if (!s) return
  Object.assign(rt.value.header, s.header)
  Object.assign(rt.value.footer, s.footer)
}
</script>

<style scoped>
.layout {
  margin-top: var(--sp-6);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-md);
  font-weight: 600;
}

.section-title i {
  color: var(--c-accent-alt-darker);
}

/* L'aperçu, au-dessus du bloc de format (hors card) dans la première colonne. */
.figure {
  width: 100%;
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 34em) minmax(0, 1fr);
  gap: var(--sp-4);
  align-items: start;
}

@media (max-width: 60em) {
  .cols {
    grid-template-columns: 1fr;
  }
}

.col {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
}

/* Cards : une seule teinte harmonisée pour toutes (format, en-têtes, styles). */
.card {
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: var(--sp-4);
  background: color-mix(in srgb, var(--c-accent-alt-darker, #2b6a6a) 5%, var(--c-surface));
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-md);
  font-weight: 600;
}

.card-title i {
  color: var(--c-accent-alt-darker);
}

.card-hint {
  margin: 0 0 var(--sp-3);
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.odt-note {
  margin-bottom: var(--sp-3);
}

.bands {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

/* Le bloc folio reprend le style d'une bande (cf. RunningBandControl). */
.band {
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  padding: var(--sp-2) var(--sp-3);
}

.band--on {
  border-color: color-mix(in srgb, var(--c-accent) 45%, var(--c-border));
}

.band-toggle {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  cursor: pointer;
  font-size: var(--fs-sm);
}

.band-name {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-weight: 600;
}

.band-name i {
  color: var(--c-accent-alt-darker);
}

.band-sub {
  font-weight: 400;
  opacity: var(--op-muted);
  font-size: var(--fs-xs);
}

.band-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
  padding-top: var(--sp-2);
  border-top: 1px dashed var(--c-border);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
}

.row-label {
  color: var(--c-ink2);
}

.folio-hint {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}

.rule-note {
  display: flex;
  gap: var(--sp-2);
  margin: var(--sp-3) 0 0;
  color: var(--c-ink2);
  font-size: var(--fs-xs);
}

.rule-note i {
  margin-top: 0.1em;
}

.link-btn {
  border: none;
  background: none;
  padding: 0;
  margin-left: var(--sp-1);
  color: var(--c-accent-alt-darker);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

.toggle {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  cursor: pointer;
}

.toggle-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.toggle-name {
  font-size: var(--fs-sm);
  font-weight: 500;
}

.toggle-desc {
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}

.toggle-state {
  margin-left: auto;
  font-size: var(--fs-sm);
  color: var(--c-ink2);
}
</style>
