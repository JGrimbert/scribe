<template>
  <div class="config-view">
    <!-- Recalibration : en MODALE, plus en plein écran — on y entre depuis le
         composer du liminaire, et on doit pouvoir en ressortir sans avoir perdu
         de vue l'écran qu'on configurait. `ImportCalibration` n'a pas de hauteur
         propre : c'est la modale qui défile, pas lui (pas de scrollbar
         imbriquée). -->
    <div v-if="preview" class="recal-modal" role="dialog" aria-modal="true" aria-label="Redéfinir les bornes du livre">
      <div class="recal-backdrop" @click="preview = null"></div>
      <div class="recal-panel">
        <header class="recal-head">
          <h3>Redéfinir les bornes du livre</h3>
          <button type="button" class="recal-close" title="Fermer" @click="preview = null">
            <i class="pi pi-times"></i>
          </button>
        </header>

        <div class="recal-body">
          <UiCallout tone="error" title="Avant de valider">
            <div>
              Recalibrer <strong>reconstruit l'arbre du livre</strong> depuis le <code>.odt</code>
              d'origine : tous les chapitres sont recréés. Vos <strong>analyses seront à
              recalculer</strong> (elles désignent des nœuds qui n'existeront plus). La typologie, les
              règles et le <code>.odt</code> sont conservés ; les validations manuelles sont réapposées
              quand le chapitre se retrouve.
            </div>
          </UiCallout>

          <ImportCalibration
              mode="recalibration"
              :preview-id="preview.previewId"
              :outline="preview.outline"
              :suggested-structure-start-index="preview.suggestedStructureStartIndex"
              :suggested-structure-end-index="preview.suggestedStructureEndIndex ?? null"
              @committed="onCommitted"
              @cancel="preview = null"
          />
        </div>
      </div>
    </div>

    <header class="config-header">
      <h2>Configuration</h2>
      <UiNote variant="hint">
        Ce que chaque style de votre <code>.odt</code> veut dire, typologie par typologie : le
        liminaire, chaque niveau de chapitrage, la partie finale. Les rôles proposés sont des
        suggestions déduites du nom du style — rien n'est enregistré tant que vous n'avez pas
        validé.
      </UiNote>

      <!-- Le rapport reste affiché : une relecture perdue doit pouvoir se lire
           et se refaire, ce qu'un toast qui s'efface interdirait. -->
      <UiCallout
          v-if="report"
          :tone="report.droppedValidations.length ? 'error' : 'info'"
          title="Recalibré"
          class="report"
      >
        <div>
          {{ report.restoredValidations }} validation(s) reposée(s)<template
              v-if="report.droppedValidations.length"
          >, {{ report.droppedValidations.length }} perdue(s) — à relire :
            <span class="dropped">
              {{ report.droppedValidations.map((d) => `${d.slug} (${d.reason})`).join(', ') }}
            </span>
          </template><template v-else>, aucune perdue.</template>
        </div>
      </UiCallout>
    </header>

    <UiNote v-if="loadError" variant="error">{{ loadError }}</UiNote>

    <template v-if="inventory.styles.length">
      <TypologySection
          v-for="section in sections"
          :key="section.zone.key"
          :zone="section.zone"
          :styles="section.styles"
          :zoned="zoned"
          :shape-group="section.shapeGroup"
          :shapes-error="shapesError"
          :depth-key="section.depthKey"
          :style-roles="styles"
          :rule-set="section.depthKey !== null ? (rules.byDepth[section.depthKey] ?? null) : null"
          :default-rule-set="rules.default"
          @toggle-rules="toggleDepth"
      >
        <!-- Les deux bornes du livre se reprennent depuis le composer : c'est
             le dernier vis-à-vis du liminaire qui dit où il s'arrête. Étendre
             comme exclure passent par le même recalibrage. -->
        <template v-if="section.zone.key === 'liminaire'" #body>
          <LiminaireComposer
              :pages="liminairePages"
              :config="liminaireConfig"
              :title="doc?.title ?? ''"
              :recalibratable="recalibratable"
              :starting="starting"
              :recal-error="recalError"
              :border-shift="borderShift"
              :can-extend="canExtend"
              :next-title="nextTitle"
              @extend="borderShift++"
              @exclude="borderShift--"
              @redefine="startRecalibration"
          />
        </template>
      </TypologySection>

      <!-- Le socle appliqué à tout niveau sans règles propres. -->
      <section class="config-section">
        <h3 class="section-title">Règles par défaut</h3>
        <p class="section-hint">
          S'appliquent à tout niveau de chapitrage qui n'a pas ses propres règles.
        </p>
        <RuleSetForm :rule-set="rules.default" />
      </section>

      <!-- Surlignages : global, point d'extension pour de vraies annotations. -->
      <section class="config-section">
        <h3 class="section-title">Surlignages <span class="count">{{ inventory.highlights.length }}</span></h3>
        <p class="section-hint">
          Un surlignage marque l'état du texte, pas sa structure. Une seule annotation pour
          l'instant ; la fonctionnalité s'étendra.
        </p>
        <p v-if="!inventory.highlights.length" class="empty">Aucun surlignage relevé.</p>
        <ul v-else class="hl-list">
          <li v-for="hl in inventory.highlights" :key="hl.color" class="hl">
            <div class="hl-head">
              <span class="swatch" :style="{ background: hl.color }"></span>
              <code>{{ hl.color }}</code>
              <span class="hl-counts">{{ hl.paragraphs }} ¶ · {{ hl.spans }} inline</span>
            </div>
            <StackedBar v-if="zoned && totalOf(hl.byZone)" :segments="zoneSegments(hl.byZone)" />
            <p v-if="hl.sample" class="hl-sample" :title="hl.sample">{{ hl.sample }}</p>
            <BaseSelect v-model="highlights[hl.color]">
              <option v-for="role in HIGHLIGHT_ROLES" :key="role" :value="role">{{ role }}</option>
            </BaseSelect>
          </li>
        </ul>

        <!-- « Non situés » vit ici, avec les surlignages : ni structure, ni
             modèles, ni règles — juste des styles (filets, ornements) à typer. -->
        <template v-if="unzonedStyles.length">
          <h3 class="section-title section-title--sub">Non situés <span class="count">{{ unzonedStyles.length }}</span></h3>
          <p class="section-hint">Paragraphes sans texte : filets, ornements. Comptés, mais situés nulle part.</p>
          <StyleRolesTable :styles="unzonedStyles" :style-roles="styles" />
        </template>
      </section>

      <footer class="config-footer">
        <UiNote v-if="saveError" variant="error">{{ saveError }}</UiNote>
        <UiNote v-else-if="saved" variant="hint">Configuration enregistrée.</UiNote>
        <UiNote v-else-if="!settled" variant="hint">
          Pas encore arbitrée — le tableau de bord le signale tant que vous n'avez pas validé.
        </UiNote>
        <div class="footer-actions">
          <BaseButton variant="solid" :busy="saving" @click="save(route.params.id)">
            Enregistrer la configuration
          </BaseButton>
          <BaseButton variant="ghost" icon="pi-trash" class="delete" :busy="deleting" @click="onDelete">
            Supprimer ce document
          </BaseButton>
        </div>
      </footer>
    </template>

    <UiNote v-else-if="!loading" variant="hint">
      Aucun style relevé pour ce document. Il a été importé avant que le parseur ne les relève — le
      <code>.odt</code> d'origine n'étant pas conservé, seul un réimport peut les récupérer.
    </UiNote>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from './ui/BaseButton.vue'
import BaseSelect from './ui/BaseSelect.vue'
import StackedBar from './ui/StackedBar.vue'
import UiCallout from './ui/UiCallout.vue'
import UiNote from './ui/UiNote.vue'
import ImportCalibration from './ImportCalibration.vue'
import RuleSetForm from './RuleSetForm.vue'
import StyleRolesTable from './StyleRolesTable.vue'
import TypologySection from './TypologySection.vue'
import LiminaireComposer from './LiminaireComposer.vue'
import { useRegistry } from '../composables/useRegistry'
import { useTypologyConfig } from '../composables/useTypologyConfig'
import { HIGHLIGHT_ROLES } from '../script/typology'
import { totalOf, zoneSegments } from '../script/zones'
import { groupLiminairePages } from '../script/liminaire'
import { absorbableCount, extendedLiminaire, nextNodeTitle } from '../script/liminaire-bornes'

const route = useRoute()
const router = useRouter()

const { documents, ensureLoaded, fetchDocuments, confirmAndDelete, deletingId } = useRegistry()
const {
  loading, loadError, saveError, saving, saved, settled,
  inventory, styles, highlights, rules, liminaireConfig, zoned,
  sections, unzonedStyles, shapesError, load, save, toggleDepth,
} = useTypologyConfig()

// Les entrées liminaire viennent de la trame (fournie par DocumentLayout), pas
// de l'endpoint typologie : c'est du contenu, pas de l'inventaire. Regroupées en
// pages pour le composer.
const trame = inject('documentTrame', null)
const documentData = inject('documentData', null)

// Déplacement LOCAL de la borne de fin du liminaire, en nombre de nœuds
// absorbés. Une prévisualisation : tant qu'il n'est pas nul, la configuration
// ne peut pas être enregistrée telle quelle — seul un recalibrage déplace la
// borne pour de bon (cf. script/liminaire-bornes).
const borderShift = ref(0)

// Repartir de zéro en changeant de document : le décalage porte sur CE
// liminaire-ci, pas sur le suivant.
watch(() => route.params.id, () => { borderShift.value = 0 })

const extendedEntries = computed(() =>
  extendedLiminaire(trame?.value?.liminaire ?? [], trame?.value?.axes ?? [], documentData?.value ?? {}, borderShift.value),
)

const canExtend = computed(
  () => borderShift.value < absorbableCount(trame?.value?.axes ?? [], documentData?.value ?? {}),
)

const nextTitle = computed(() =>
  nextNodeTitle(trame?.value?.axes ?? [], documentData?.value ?? {}, borderShift.value),
)

// Dépend de liminaireConfig : fusionner/scinder une page recompose le découpage
// dans le même tick.
const liminairePages = computed(() => groupLiminairePages(extendedEntries.value, liminaireConfig))

// Les stats se lisent dans le registre, déjà chargé pour l'aside de cet écran :
// `GET /documents/:id` ne les porte pas.
const doc = computed(() => documents.value.find((d) => d.id === route.params.id) ?? null)
const deleting = computed(() => deletingId.value === route.params.id)

// Tant que le registre n'est pas chargé on ne barre pas le bouton (il
// clignoterait) ; le 404 du backend reste le filet.
const recalibratable = computed(() => doc.value?.hasSource !== false)

const preview = ref(null)
const report = ref(null)

// Échap ferme la modale de recalibration. Posé sur `window` et non sur le
// panneau : le focus peut être n'importe où dans la calibration (un accordéon
// entier), un handler local ne verrait pas la touche.
function onEscape(event) {
  if (event.key === 'Escape' && preview.value) preview.value = null
}
onMounted(() => window.addEventListener('keydown', onEscape))
onUnmounted(() => window.removeEventListener('keydown', onEscape))

const starting = ref(false)
const recalError = ref(null)

// Recharge trame/data chez DocumentLayout : une recalibration regénère tous les
// ids de nœuds.
const reloadDocument = inject('reloadDocument', null)

onMounted(ensureLoaded)
watch(() => route.params.id, (id) => id && load(id), { immediate: true })

async function startRecalibration() {
  starting.value = true
  recalError.value = null
  report.value = null
  try {
    const res = await fetch(`/api/documents/${route.params.id}/recalibrate`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.message || `HTTP ${res.status}`)
    }
    preview.value = await res.json()
  } catch (e) {
    recalError.value = `Recalibration impossible : ${e.message}`
  } finally {
    starting.value = false
  }
}

async function onCommitted(summary) {
  preview.value = null
  report.value = summary.recalibration ?? null
  await fetchDocuments()
  reloadDocument?.()
  // La ventilation par zone change : on recharge la typologie/les modèles.
  await load(route.params.id)
}

async function onDelete() {
  if (doc.value && (await confirmAndDelete(doc.value))) router.push('/')
}
</script>

<style scoped>
/* Modale de recalibration. Elle DÉFILE elle-même (`overflow-y` sur le panneau)
   parce qu'`ImportCalibration` n'a délibérément pas de hauteur propre : lui en
   donner une remettrait la scrollbar imbriquée que le design system proscrit.
   C'est donc le panneau, et lui seul, qui porte le défilement. */
.recal-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-4);
}

.recal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.recal-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 62em);
  max-height: 100%;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
}

.recal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--c-border);
}

.recal-head h3 {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 600;
}

.recal-close {
  border: 0;
  background: none;
  color: var(--c-ink2);
  font: inherit;
  cursor: pointer;
}

.recal-close:hover { color: var(--c-accent); }

.recal-body {
  padding: var(--sp-4);
  overflow-y: auto;
}

.config-view {
  padding: 1.25em;
  /* La DocumentBar est absolue AU-DESSUS de la zone de défilement : sans
     réserver sa hauteur, le titre se lit à travers la barre. --bar-size est la
     variable qui donne sa hauteur à la barre. */
  padding-top: calc(var(--bar-size) + 1.25em);
  /* Plein usage de la largeur : les tableaux de styles et les grilles 2/3·1/3
     ont besoin de place — l'ancien cap à 70em les étranglait. */
}

.config-header h2 {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-lg);
}

.report {
  margin-top: var(--sp-3);
}

.dropped {
  font-family: var(--font-ui);
  font-weight: 600;
}

.config-section {
  margin-top: var(--sp-6);
}

.section-title {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-md);
  font-weight: 600;
}

.section-hint {
  margin: 0 0 var(--sp-3);
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

/* « Non situés » : sous-section de la zone Surlignages, décrochée mais moindre. */
.section-title--sub {
  margin-top: var(--sp-5);
  font-size: var(--fs-sm);
}

.count {
  opacity: var(--op-faint);
  font-weight: 400;
}

.empty {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-md);
}


/* Une grille qui remplit la largeur plutôt qu'une colonne étroite : chaque
   surlignage se décide couleur par couleur, mais rien n'oblige à les empiler. */
.hl-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16em, 1fr));
  gap: var(--sp-4);
}

.hl {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-width: 0;
}

.hl-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
}

.swatch {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  vertical-align: -0.15em;
}

.hl-counts {
  margin-left: auto;
  color: var(--c-ink2);
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hl-sample {
  margin: 0;
  color: var(--c-ink2);
  font-family: var(--font-serif);
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-footer {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-top: var(--sp-6);
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-left: auto;
}

/* La suppression cède le pas à l'action normale de l'écran : discrète, et rouge
   seulement quand on la vise. */
.delete:hover {
  color: var(--c-danger);
}
</style>
