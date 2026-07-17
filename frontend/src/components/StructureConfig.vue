<template>
  <div class="structure-config">
    <!-- Calibration en cours : elle prend tout le volet. Le previewId sait déjà
         qu'il s'agit d'un remplacement — même écran, même flux qu'à l'import. -->
    <template v-if="preview">
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
    </template>

    <template v-else>
      <div v-if="doc" class="stats">
        <StatItem :value="doc.totalAxes" label="axes" />
        <StatItem :value="doc.totalBlocs" label="blocs" />
        <StatItem :value="doc.totalArticles" label="articles" />
        <StatItem :value="formatInt(doc.totalMots)" label="mots" />
        <StatItem :value="formatInt(doc.totalCaracteres)" label="caractères" />
        <StatItem
            :value="formatBytes(doc.sourceSizeBytes)"
            label=".odt conservé"
            :empty="!doc.hasSource"
            hint="Le fichier d'origine, gardé en base : c'est lui qui rend la calibration rejouable."
        />
      </div>

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

      <UiNote variant="hint">
        Les deux bornes du livre et le niveau de chaque titre commandent tout le reste : les zones,
        la répartition des styles, les rôles proposés, les modèles, puis les règles. C'est le seul
        endroit où l'on peut les reprendre après coup — l'import n'est plus à sens unique, le
        <code>.odt</code> d'origine étant conservé.
      </UiNote>

      <UiNote v-if="!recalibratable" variant="hint">
        Ce document a été importé avant que le <code>.odt</code> ne soit conservé : il n'est pas
        recalibrable. Seul un réimport rattache son fichier d'origine — et le rend ventilable par
        zones au passage.
      </UiNote>

      <UiNote v-if="error" variant="error">{{ error }}</UiNote>

      <div class="actions">
        <BaseButton
            variant="accent"
            icon="pi-refresh"
            :disabled="!recalibratable"
            :busy="starting"
            @click="start"
        >
          Recalibrer le document
        </BaseButton>
        <BaseButton variant="ghost" icon="pi-trash" class="delete" :busy="deleting" @click="onDelete">
          Supprimer ce document
        </BaseButton>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from './ui/BaseButton.vue'
import StatItem from './ui/StatItem.vue'
import UiCallout from './ui/UiCallout.vue'
import UiNote from './ui/UiNote.vue'
import ImportCalibration from './ImportCalibration.vue'
import { useRegistry } from '../composables/useRegistry'
import { formatBytes, formatInt } from '../script/format'

const route = useRoute()
const router = useRouter()

const { documents, ensureLoaded, fetchDocuments, confirmAndDelete, deletingId } = useRegistry()

// Les stats se lisent dans le registre, déjà chargé pour l'aside de cet écran :
// `GET /documents/:id` ne les porte pas, et un second appel pour cinq nombres
// qui sont là serait un aller-retour pour rien.
const doc = computed(() => documents.value.find((d) => d.id === route.params.id) ?? null)
const deleting = computed(() => deletingId.value === route.params.id)

// Tant que le registre n'est pas chargé on ne sait pas : on ne barre pas le
// bouton par défaut, sinon il clignoterait d'inactif à actif à chaque arrivée
// sur l'écran. Le 404 du backend reste le filet en dessous.
const recalibratable = computed(() => doc.value?.hasSource !== false)

const preview = ref(null)
const report = ref(null)
const starting = ref(false)
const error = ref(null)

// Recharge trame/data chez DocumentLayout : une recalibration regénère TOUS les
// ids de nœuds, le fil d'Ariane et l'arbre pointeraient sinon sur des chapitres
// disparus.
const reloadDocument = inject('reloadDocument', null)

onMounted(ensureLoaded)

async function start() {
  starting.value = true
  error.value = null
  report.value = null
  try {
    const res = await fetch(`/api/documents/${route.params.id}/recalibrate`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.message || `HTTP ${res.status}`)
    }
    preview.value = await res.json()
  } catch (e) {
    // Cas courant : le document a été importé avant que le .odt ne soit
    // conservé. Le backend le dit explicitement, on relaie son message tel quel
    // plutôt que de le paraphraser.
    error.value = `Recalibration impossible : ${e.message}`
  } finally {
    starting.value = false
  }
}

async function onCommitted(summary) {
  preview.value = null
  report.value = summary.recalibration ?? null
  await fetchDocuments()
  reloadDocument?.()
}

async function onDelete() {
  if (doc.value && (await confirmAndDelete(doc.value))) router.push('/')
}
</script>

<style scoped>
.structure-config {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.dropped {
  font-family: var(--font-ui);
  font-weight: 600;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-top: var(--sp-2);
}

/* La suppression cède le pas à l'action normale de l'écran : discrète, à
   distance, et rouge seulement quand on la vise. */
.delete {
  margin-left: auto;
}

.delete:hover {
  color: var(--c-danger);
}
</style>
