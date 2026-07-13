<template>
  <div class="calibration">
    <div class="calibration-header">
      <h2>Calibrage de l'import</h2>
      <UiNote variant="hint">
        Cliquez la ligne de démarcation à l'endroit où le vrai contenu
        commence (tout ce qui précède part en liminaire). Dépliez un titre
        pour voir ses sous-titres ; +/− change son niveau. Le repère ⤓
        signale un saut de page forcé — souvent (pas toujours) un signe de
        niveau supérieur.
      </UiNote>
    </div>

    <div class="outline">
      <template v-for="item in topLevelItems" :key="item.entry.index">
        <div
            class="divider"
            :class="{ 'divider--active': item.entry.index === structureStartIndex }"
            @click="structureStartIndex = item.entry.index"
        >
          <span class="divider-label">Début du contenu</span>
        </div>

        <div v-if="item.type === 'liminaire'" class="liminaire-row">
          {{ item.entry.text }}
        </div>
        <CalibrationNode v-else :node="item.node" @level-change="onLevelChange" />
      </template>
    </div>

    <div class="calibration-footer">
      <UiNote v-if="error" variant="error" class="footer-error">{{ error }}</UiNote>
      <BaseButton variant="outline" @click="$emit('cancel')">Annuler</BaseButton>
      <BaseButton variant="solid" :busy="committing" @click="onCommit">
        {{ committing ? 'Import en cours…' : "Valider l'import" }}
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
})

const emit = defineEmits(['committed', 'cancel'])

const structureStartIndex = ref(props.suggestedStructureStartIndex)
const levelOverrides = reactive({})
const committing = ref(false)
const error = ref(null)

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

const topLevelItems = computed(() => {
  const items = []
  for (const entry of props.outline) {
    const withLevel = { ...entry, effectiveLevel: effectiveLevel(entry) }
    if (entry.index < structureStartIndex.value) {
      items.push({ type: 'liminaire', entry: withLevel })
    } else {
      break
    }
  }

  const structureEntries = props.outline
      .filter((e) => e.index >= structureStartIndex.value)
      .map((e) => ({ ...e, effectiveLevel: effectiveLevel(e) }))

  for (const root of buildTree(structureEntries)) {
    items.push({ type: 'node', node: root, entry: root.entry })
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
    error.value = `Échec de l'import : ${e.message}`
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

.outline {
  overflow-y: auto;
  flex: 1 1 auto;
  max-height: 68vh;
  padding: 0.25em;
}

.liminaire-row {
  padding: 0.5em 1em;
  margin-bottom: 0.35em;
  opacity: 0.4;
  font-size: 0.9em;
}

.divider {
  height: 0.6em;
  margin: 0.1em 0;
  cursor: pointer;
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

.divider-label {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.7em;
  padding: 0.1em 0.6em;
  border-radius: 1em;
  background: var(--c-accent);
  color: white;
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
}

.divider:hover .divider-label {
  opacity: 0.6;
}

.divider--active::before {
  opacity: 1;
  height: 2px;
  background: var(--c-accent);
}

.divider--active .divider-label {
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
