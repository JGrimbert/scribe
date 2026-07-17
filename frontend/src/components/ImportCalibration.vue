<template>
  <div class="calibration">
    <div class="calibration-header">
      <h2 v-if="mode === 'import'">Calibrage de l'import</h2>
      <UiNote variant="hint">
        Posez les deux démarcations : là où le vrai contenu commence (ce qui
        précède part en liminaire) et, s'il y en a une, là où la partie finale
        commence — table des matières, index, glossaire. Ce sont les deux bouts
        qui ne sont pas de la structure du livre. Dépliez un titre pour voir ses
        sous-titres ; +/− change son niveau. Le repère ⤓ signale un saut de page
        forcé — souvent (pas toujours) un signe de niveau supérieur.
      </UiNote>
    </div>

    <div class="outline">
      <template v-for="item in topLevelItems" :key="item.entry.index">
        <div
            class="divider"
            :class="{
              'divider--marked': item.entry.index === structureStartIndex || item.entry.index === structureEndIndex,
            }"
        >
          <div class="divider-handles">
            <button
                v-if="item.entry.index <= (structureEndIndex ?? Infinity)"
                class="divider-handle"
                :class="{ 'divider-handle--active': item.entry.index === structureStartIndex }"
                type="button"
                @click="structureStartIndex = item.entry.index"
            >
              Début du contenu
            </button>
            <button
                v-if="item.entry.index > structureStartIndex"
                class="divider-handle"
                :class="{ 'divider-handle--active': item.entry.index === structureEndIndex }"
                type="button"
                @click="toggleEnd(item.entry.index)"
            >
              {{ item.entry.index === structureEndIndex ? 'Partie finale ✕' : 'Partie finale' }}
            </button>
          </div>
        </div>

        <CalibrationNode v-if="item.type === 'node'" :node="item.node" @level-change="onLevelChange" />
        <div v-else class="matter-row">{{ item.entry.text }}</div>
      </template>
    </div>

    <div class="calibration-footer">
      <UiNote v-if="error" variant="error" class="footer-error">{{ error }}</UiNote>
      <BaseButton variant="outline" @click="$emit('cancel')">Annuler</BaseButton>
      <BaseButton variant="solid" :busy="committing" @click="onCommit">
        {{ commitLabel }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import BaseButton from './ui/BaseButton.vue'
import UiNote from './ui/UiNote.vue'
import CalibrationNode from './CalibrationNode.vue'

const props = defineProps({
  previewId: { type: String, required: true },
  outline: { type: Array, required: true },
  suggestedStructureStartIndex: { type: Number, required: true },
  // Absent = le backend n'a rien trouvé de probant. Pas d'erreur : le livre
  // n'a alors pas de partie finale tant que l'utilisateur n'en pose pas une.
  suggestedStructureEndIndex: { type: Number, default: null },
  // Le flux est le même des deux côtés — c'est le previewId qui sait s'il
  // s'agit d'un remplacement (cf. `backend/CLAUDE.md`). Seuls les mots
  // changent : on ne « valide pas un import » quand on refait celui d'hier.
  mode: { type: String, default: 'import', validator: (v) => ['import', 'recalibration'].includes(v) },
})

const emit = defineEmits(['committed', 'cancel'])

const structureStartIndex = ref(props.suggestedStructureStartIndex)
const structureEndIndex = ref(props.suggestedStructureEndIndex)
const levelOverrides = reactive({})
const committing = ref(false)
const error = ref(null)

const isRecalibration = computed(() => props.mode === 'recalibration')

const commitLabel = computed(() => {
  if (isRecalibration.value) return committing.value ? 'Reconstruction…' : 'Recalibrer et remplacer'
  return committing.value ? 'Import en cours…' : "Valider l'import"
})

// Re-cliquer la démarcation posée la retire : la partie finale est facultative,
// et une suggestion fausse doit pouvoir être annulée, pas seulement déplacée.
function toggleEnd(index) {
  structureEndIndex.value = structureEndIndex.value === index ? null : index
}

function effectiveLevel(entry) {
  return levelOverrides[entry.index] ?? entry.level
}

function onLevelChange(index, newLevel) {
  levelOverrides[index] = Math.max(0, newLevel)
}

// Reconstruit, côté client, la même hiérarchie que le backend (buildParsedResult) :
// `level` ferme les ancêtres ouverts de niveau >= lui puis s'empile — un saut
// de niveau s'imbrique directement sous le dernier ancêtre survivant, sans
// nœud fantôme. Sert uniquement à prévisualiser l'accordéon, pas à valider.
function buildTree(entries) {
  const roots = []
  const stack = [] // { node, level }
  for (const entry of entries) {
    const level = entry.effectiveLevel
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    const node = { entry, children: [] }
    const parent = stack[stack.length - 1]
    if (parent) parent.node.children.push(node)
    else roots.push(node)
    stack.push({ node, level })
  }
  return roots
}

// Les deux bouts ne sont pas de la structure : ils s'affichent à plat, dans
// l'ordre du document, et seul le corps passe par l'accordéon.
function isFinal(index) {
  return structureEndIndex.value != null && index >= structureEndIndex.value
}

const topLevelItems = computed(() => {
  const withLevel = (e) => ({ ...e, effectiveLevel: effectiveLevel(e) })
  const items = []

  for (const entry of props.outline) {
    if (entry.index < structureStartIndex.value) items.push({ type: 'liminaire', entry: withLevel(entry) })
  }

  const bodyEntries = props.outline
      .filter((e) => e.index >= structureStartIndex.value && !isFinal(e.index))
      .map(withLevel)

  for (const root of buildTree(bodyEntries)) {
    items.push({ type: 'node', node: root, entry: root.entry })
  }

  for (const entry of props.outline) {
    if (isFinal(entry.index)) items.push({ type: 'final', entry: withLevel(entry) })
  }

  return items
})

async function onCommit() {
  committing.value = true
  error.value = null
  try {
    const overrides = {}
    for (const [index, level] of Object.entries(levelOverrides)) {
      if (level !== undefined) overrides[index] = level
    }

    const res = await fetch(`/api/documents/preview/${props.previewId}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structureStartIndex: structureStartIndex.value,
        // Omis quand il n'y a pas de partie finale — `undefined` ne sera pas
        // sérialisé, et c'est bien ce que le backend attend.
        ...(structureEndIndex.value != null ? { structureEndIndex: structureEndIndex.value } : {}),
        levelOverrides: overrides,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.message || `HTTP ${res.status}`)
    }
    const summary = await res.json()
    emit('committed', summary)
  } catch (e) {
    error.value = `${isRecalibration.value ? 'Échec de la recalibration' : "Échec de l'import"} : ${e.message}`
  } finally {
    committing.value = false
  }
}
</script>

<style scoped>
.calibration {
  padding: 1.5em;
  max-width: 80ch;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.calibration-header h2 {
  margin: 0 0 0.5em;
}

/* Pas d'`overflow-y: auto` ni de `max-height` ici : la liste défile avec la
   page, dans la CustomScrollbar qui l'entoure (config) ou celle du navigateur
   (/import). Une hauteur propre y ajouterait une seconde barre imbriquée. */
.outline {
  flex: 1 1 auto;
  padding: 0.25em;
}

/* Liminaire et final : hors structure, donc en retrait — ils se lisent pour se
   repérer, ils ne se calibrent pas. */
.matter-row {
  padding: 0.5em 1em;
  margin-bottom: 0.35em;
  opacity: 0.4;
  font-size: 0.9em;
}

.divider {
  height: 0.6em;
  margin: 0.1em 0;
  position: relative;
  display: flex;
  align-items: center;
}

.divider::before {
  content: '';
  flex: 1 1 auto;
  height: 1px;
  background: var(--c-border, #e0d8cc);
  opacity: 0;
  transition: opacity 0.1s ease;
}

.divider:hover::before {
  opacity: 1;
}

.divider-handles {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.35em;
}

.divider-handle {
  font: inherit;
  font-size: 0.7em;
  padding: 0.1em 0.6em;
  border: 0;
  border-radius: 1em;
  background: var(--c-accent);
  color: white;
  white-space: nowrap;
  cursor: pointer;
  /* Invisibles au repos : deux pastilles devant chaque titre, ce serait une
     guirlande. Elles n'apparaissent qu'au survol de LEUR démarcation, ou si
     elles portent une borne posée. */
  opacity: 0;
  transition: opacity 0.1s ease;
}

.divider:hover .divider-handle {
  opacity: 0.6;
}

.divider--marked::before {
  opacity: 1;
  height: 2px;
  background: var(--c-accent);
}

.divider-handle--active,
.divider:hover .divider-handle--active {
  opacity: 1;
}

.calibration-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75em;
  margin-top: 1em;
}

.footer-error {
  /* pousse le callout d'échec à gauche du footer ; le chrome (fond/bordure/
     padding) vient de UiCallout */
  margin-right: auto;
}
</style>
