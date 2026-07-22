<template>
  <div class="config-view">
    <!-- Recalibration : en MODALE, plus en plein écran — on y entre depuis le
         composer du liminaire, et on doit pouvoir en ressortir sans avoir perdu
         de vue l'écran qu'on configurait.
         `recalOpen` est DISTINCT de `preview` : la modale s'ouvre d'abord, et
         attend son contenu dedans. Conditionner l'ouverture aux données faisait
         patienter sur un écran inchangé, sans rien dire. -->
    <div v-if="recalOpen" class="recal-modal" role="dialog" aria-modal="true" aria-label="Redéfinir les bornes du livre">
      <div class="recal-backdrop" @click="closeRecal"></div>
      <div class="recal-panel">
        <header class="recal-head">
          <h3>Redéfinir les bornes</h3>
          <!-- Le mode d'emploi passe en pastille : il se consulte, il n'a pas à
               occuper une ligne à chaque ouverture. -->
          <UiHint text="Posez le début du contenu (ce qui précède part en liminaire) et, s'il y en a une, la partie finale — table des matières, index, glossaire. Dépliez un titre pour voir ses sous-titres." />
          <button type="button" class="recal-close" title="Fermer" @click="closeRecal">
            <i class="pi pi-times"></i>
          </button>
        </header>

        <p v-if="starting" class="recal-wait">
          <i class="pi pi-spin pi-spinner"></i> Relecture du fichier d'origine…
        </p>

        <UiNote v-else-if="recalError" variant="error" class="recal-fail">{{ recalError }}</UiNote>

        <ImportCalibration
            v-else-if="preview"
            class="recal-calibration"
            mode="recalibration"
            :preview-id="preview.previewId"
            :outline="preview.outline"
            :suggested-structure-start-index="preview.suggestedStructureStartIndex"
            :suggested-structure-end-index="preview.suggestedStructureEndIndex ?? null"
            :current-structure-start-index="shiftedStartIndex"
            :current-structure-end-index="preview.currentStructureEndIndex ?? null"
            @committed="onCommitted"
            @cancel="closeRecal"
        />
      </div>
    </div>

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
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../ui/BaseButton.vue'
import BaseSelect from '../ui/BaseSelect.vue'
import StackedBar from '../ui/StackedBar.vue'
import UiCallout from '../ui/UiCallout.vue'
import UiHint from '../ui/UiHint.vue'
import UiNote from '../ui/UiNote.vue'
import ImportCalibration from '../import/ImportCalibration.vue'
import RuleSetForm from './RuleSetForm.vue'
import StyleRolesTable from './StyleRolesTable.vue'
import TypologySection from './TypologySection.vue'
import LiminaireComposer from '../liminaire/LiminaireComposer.vue'
import { useRegistry } from '../../composables/useRegistry'
import { useTypologyConfig } from '../../composables/useTypologyConfig'
import { HIGHLIGHT_ROLES } from '../../script/typology'
import { totalOf, zoneSegments } from '../../script/zones'
import { groupLiminairePages } from '../../script/liminaire'
import { absorbableCount, extendedLiminaire, nextNodeTitle } from '../../script/liminaire-bornes'

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

// L'OUVERTURE de la modale, distincte de son contenu : elle s'affiche dès le
// clic et porte elle-même l'attente. Sans ça, le clic restait sans effet visible
// le temps que le backend relise le `.odt`.
const recalOpen = ref(false)

function closeRecal() {
  recalOpen.value = false
  preview.value = null
  recalError.value = null
}

// La borne à proposer dans la calibration : celle du document, AVANCÉE du
// décalage prévisualisé dans le composer. C'est ce qui relie l'aperçu au
// recalibrage — sans la borne courante rendue par le backend, on ne pouvait
// qu'ouvrir la calibration sur une suggestion sans rapport avec le geste.
const shiftedStartIndex = computed(() => {
  const current = preview.value?.currentStructureStartIndex
  if (current == null) return null
  return current + borderShift.value
})

// Échap ferme la modale de recalibration. Posé sur `window` et non sur le
// panneau : le focus peut être n'importe où dans la calibration (un accordéon
// entier), un handler local ne verrait pas la touche.
function onEscape(event) {
  if (event.key === 'Escape' && recalOpen.value) closeRecal()
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
  // La modale s'ouvre AVANT l'appel : elle est le lieu de l'attente, pas sa
  // récompense.
  recalOpen.value = true
  preview.value = null
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
  closeRecal()
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
.report-analyses {
  margin-top: var(--sp-2);
}

/* Modale de recalibration.
   `z-index` AU-DESSUS de la doc-bar (99) : l'overlay doit la recouvrir, elle et
   son bouton « Relancer l'analyse » — un bouton d'analyse encore vif pendant
   qu'on reconstruit l'arbre du livre invite à une opération contradictoire.
   Le panneau, lui, reste calé SOUS la barre (padding-top), qui garde ainsi son
   fil d'Ariane lisible à travers le voile. */
.recal-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Deux barres à dégager en haut (topbar + doc-bar), d'où le facteur 2. */
  padding: calc(var(--bar-size) * 2 + var(--sp-4)) var(--sp-4) var(--sp-4);
}

/* Voile CLAIR, pas un assombrissement : le panneau floute ce qu'il a derrière
   lui, donc un overlay noir se retrouvait mélangé dans sa propre teinte et
   salissait le blanc de la modale. Un blanc très dilué + un flou léger
   détachent l'arrière-plan sans le teindre. */
.recal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(2px);
}

/* Hauteur PLAFONNÉE, et pas seulement bornée au viewport : la calibration est
   une liste longue, un panneau à sa mesure remplissait tout l'écran et
   redevenait le plein écran qu'on venait de quitter. */
.recal-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 62em);
  /* `height` et non `max-height` : la liste étant posée en absolu dans son
     conteneur (cf. ImportCalibration), elle ne « pousse » plus le panneau — sans
     hauteur à distribuer, tout s'effondrait à quelques pixels. La modale a donc
     une taille de travail stable, que la liste soit longue ou courte. */
  height: min(100%, 34em);
  /* Le panneau ne peint AUCUN fond : il ne porte que le flou, le cadre et
     l'ombre. Ses deux sections (header, corps) posent chacune le leur, côte à
     côte. Un fond sur le panneau se serait ajouté au leur — deux couches
     translucides superposées, dont la teinte n'est plus celle qu'on a écrite.
     `overflow: hidden` fait suivre au fond des sections l'arrondi du cadre. */
  backdrop-filter: blur(10px);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

/* Reprend la signature exacte de la doc-bar (fond, encre, flou, filet) : c'est
   la même famille de surface. Les tokens `--c-doc-bar-*` sont posés par
   `base.css` sur `.doc-bar` via `[data-bar-theme]` — d'où leur reprise ici, avec
   le repli teal si aucun thème n'a été appliqué.
   Le padding négatif ramène la barre aux bords du panneau, dont le padding
   latéral vaut pour le contenu, pas pour elle. */
.recal-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  /* Teinté (signature de la doc-bar), là où le corps est blanc : c'est ce
     contraste qui sépare le bandeau du contenu. Pas de `backdrop-filter` ici —
     le panneau floute déjà, un second flou n'ajouterait rien et empilerait une
     couche de plus. */
  background: var(--c-doc-bar-bck, rgba(142, 212, 225, 0.3));
  border-bottom: var(--c-doc-bar-border, 1px solid var(--c-accent-alt));
}

.recal-head h3 {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 600;
}

/* Pousse la croix à droite — le `?` doit rester collé au titre qu'il explique. */
.recal-close { margin-left: auto; }

.recal-close {
  border: 0;
  background: none;
  color: var(--c-ink2);
  font: inherit;
  cursor: pointer;
}

.recal-close:hover { color: var(--c-accent); }

/* Le CORPS : blanc translucide, distinct du bandeau teinté. C'est lui qui porte
   le padding du contenu (le panneau n'en a plus, sinon le bandeau ne pourrait
   pas aller d'un bord à l'autre). */
.recal-wait,
.recal-fail,
.recal-calibration {
  flex: 1 1 auto;
  min-height: 0;
  /* 0,45 et non 0,62 : au-delà, le corps composite à ~(254,251,245) sur le fond
     sable, soit un blanc que les lignes de titre (blanches, elles) ne peuvent
     plus quitter. En laissant passer davantage de sable, le fond se réchauffe
     et les lignes s'en détachent pour de bon. */
  background: rgba(255, 255, 255, 0.45);
  padding: var(--sp-4);
}

/* Attente et échec : centrés dans la place que prendra la calibration, pour que
   le panneau ne saute pas de composition quand elle arrive. */
.recal-wait,
.recal-fail {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
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
