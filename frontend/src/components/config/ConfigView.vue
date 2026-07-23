<template>
  <div class="config-view">
    <RecalibrationModal
        :open="recalOpen"
        :starting="starting"
        :recal-error="recalError"
        :preview="preview"
        :shifted-start-index="shiftedStartIndex"
        @close="closeRecal"
        @committed="onCommitted"
    />

    <header class="config-header">
      <!-- Même icône que l'entrée « Configuration » de la topbar : l'écran se
           reconnaît au même signe que le bouton qui y mène. -->
      <h2><i class="pi pi-sliders-h" aria-hidden="true"></i>Configuration</h2>
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

        <!-- Le sort des analyses : elles survivent désormais au recalibrage
             (les ids des chapitres retrouvés sont conservés). Ce qu'il faut
             dire, c'est ce qui a BOUGÉ — les chapitres qu'on n'a pas su
             rattacher, dont les analyses ne parlent plus. -->
        <div v-if="report.analysesKept === false" class="report-analyses">
          Analyses supprimées : aucun chapitre n'a pu être rattaché à sa version précédente.
        </div>
        <div v-else-if="report.orphanedNodes" class="report-analyses">
          Analyses conservées ({{ report.reusedNodes }} chapitres rattachés), mais
          {{ report.orphanedNodes }} n'ont pas été retrouvés : leurs résultats sont à recalculer.
        </div>
        <div v-else-if="report.reusedNodes" class="report-analyses">
          Analyses conservées — les {{ report.reusedNodes }} chapitres ont tous été rattachés.
        </div>
      </UiCallout>
    </header>

    <UiNote v-if="loadError" variant="error">{{ loadError }}</UiNote>

    <!-- Mise en page : propriétés globales du livre, indépendantes des styles —
         format de page (lu du .odt) + réglages typographiques généraux (césure…).
         Affiché même sur un document sans inventaire (le format vient du .odt). -->
    <LayoutSection :page="documentPage" :style-defaults="styleDefaults" />

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
          :data="documentData"
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
import { computed, inject, onMounted, onUnmounted, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../ui/atoms/BaseButton.vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import StackedBar from '../ui/atoms/StackedBar.vue'
import UiCallout from '../ui/atoms/UiCallout.vue'
import UiNote from '../ui/molecules/UiNote.vue'
import RuleSetForm from './RuleSetForm.vue'
import StyleRolesTable from './StyleRolesTable.vue'
import TypologySection from './TypologySection.vue'
import LayoutSection from './LayoutSection.vue'
import RecalibrationModal from './RecalibrationModal.vue'
import LiminaireComposer from '../liminaire/LiminaireComposer.vue'
import { useRegistry } from '../../composables/useRegistry'
import { useTypologyConfig } from '../../composables/useTypologyConfig'
import { useLiminaireBornes } from '../../composables/useLiminaireBornes'
import { useRecalibration } from '../../composables/useRecalibration'
import { HIGHLIGHT_ROLES } from '../../script/typology'
import { totalOf, zoneSegments } from '../../script/zones'

const route = useRoute()
const router = useRouter()

const NO_SOURCE_HINT =
    "Recalibrage impossible : le .odt d'origine n'a pas été conservé (document importé avant cette fonctionnalité). Seul un réimport permet de refixer les bornes."

const { documents, ensureLoaded, fetchDocuments, confirmAndDelete, deletingId } = useRegistry()
const {
  loading, loadError, saveError, saving, saved, settled,
  inventory, styles, highlights, rules, liminaireConfig, styleDefaults, zoned,
  sections, unzonedStyles, shapesError, load, save, toggleDepth,
} = useTypologyConfig()

// Les entrées liminaire viennent de la trame (fournie par DocumentLayout), pas
// de l'endpoint typologie : c'est du contenu, pas de l'inventaire.
const trame = inject('documentTrame', null)
const documentData = inject('documentData', null)
const documentPage = inject('documentPage', null)

const { borderShift, canExtend, nextTitle, liminairePages } = useLiminaireBornes(trame, documentData, liminaireConfig)

const docId = computed(() => route.params.id)
const {
  preview, report, recalOpen, starting, recalError, shiftedStartIndex,
  startRecalibration, closeRecal, finishCommit,
} = useRecalibration({ docId, borderShift })

// Les stats se lisent dans le registre, déjà chargé pour l'aside de cet écran :
// `GET /documents/:id` ne les porte pas.
const doc = computed(() => documents.value.find((d) => d.id === route.params.id) ?? null)
const deleting = computed(() => deletingId.value === route.params.id)

// Tant que le registre n'est pas chargé on ne barre pas le bouton (il
// clignoterait) ; le 404 du backend reste le filet.
const recalibratable = computed(() => doc.value?.hasSource !== false)

// Le CTA de recalibrage vit dans la doc-bar (zone d'action globale), à la place
// du « Relancer l'analyse » propre à l'écran d'analyse : c'est le MÊME slot,
// contextuel par écran. On y pose l'action tant que la config est montée ; la
// doc-bar la rend, l'analyse reprend la main quand on quitte l'écran (unmount).
// Barré si le `.odt` d'origine n'est pas conservé, le `title` disant pourquoi.
const barAction = inject('documentBarAction', null)
watchEffect(() => {
  if (!barAction) return
  barAction.value = {
    label: 'Redéfinir les bornes',
    icon: 'pi-refresh',
    disabled: !recalibratable.value,
    busy: starting.value,
    title: recalibratable.value ? undefined : NO_SOURCE_HINT,
    run: startRecalibration,
  }
})
onUnmounted(() => { if (barAction) barAction.value = null })

// Recharge trame/data chez DocumentLayout : une recalibration regénère tous les
// ids de nœuds.
const reloadDocument = inject('reloadDocument', null)

onMounted(ensureLoaded)
watch(() => route.params.id, (id) => id && load(id), { immediate: true })

async function onCommitted(summary) {
  finishCommit(summary)
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
.report-analyses {
  margin-top: var(--sp-2);
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

/* Teal profond : la teinte de la topbar (`--c-accent-alt-darker`), celle qui
   identifie l'application — pas le brun du corps de texte. */
.config-header h2 {
  margin: 0 0 var(--sp-2);
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-lg);
  color: var(--c-accent-alt-darker);
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
