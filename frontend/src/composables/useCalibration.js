import { computed, reactive, ref } from 'vue'
import { partitionOutline } from '../script/calibration'

// L'état de l'écran de calibration : les deux bornes du livre, les niveaux de
// titre forcés, et le commit vers `POST /preview/:id/commit`. La reconstruction
// de l'arbre (pure) vit dans `script/calibration.js` ; ici, l'état Vue et l'appel
// réseau. Reçoit `props` (défini par le composant) et `emit` (pour 'committed').
export function useCalibration(props, emit) {
  // La borne validée l'emporte sur la suggestion ; `??` et non `||` : l'index 0
  // est une borne parfaitement légitime (un livre sans liminaire).
  const structureStartIndex = ref(props.currentStructureStartIndex ?? props.suggestedStructureStartIndex)
  const structureEndIndex = ref(props.currentStructureEndIndex ?? props.suggestedStructureEndIndex)
  const levelOverrides = reactive({})
  const committing = ref(false)
  const error = ref(null)

  const isRecalibration = computed(() => props.mode === 'recalibration')

  const commitLabel = computed(() => {
    if (isRecalibration.value) return committing.value ? 'Reconstruction…' : 'Recalibrer'
    return committing.value ? 'Import en cours…' : "Valider l'import"
  })

  // Les bornes ont-elles VRAIMENT bougé depuis celles du document ? Comparé aux
  // bornes courantes, pas aux suggestions — c'est le réglage en base qui fait foi.
  // `currentStructureStartIndex` est nul à l'import et sur un document antérieur à
  // ces colonnes : on ne peut alors rien comparer, donc rien à avertir.
  const bornesChanged = computed(() => {
    if (!isRecalibration.value || props.currentStructureStartIndex == null) return false
    return (
        structureStartIndex.value !== props.currentStructureStartIndex ||
        structureEndIndex.value !== props.currentStructureEndIndex
    )
  })

  // Re-cliquer la démarcation posée la retire : la partie finale est facultative,
  // et une suggestion fausse doit pouvoir être annulée, pas seulement déplacée.
  function toggleEnd(index) {
    structureEndIndex.value = structureEndIndex.value === index ? null : index
  }

  function onLevelChange(index, newLevel) {
    levelOverrides[index] = Math.max(0, newLevel)
  }

  const topLevelItems = computed(() =>
    partitionOutline(props.outline, {
      startIndex: structureStartIndex.value,
      endIndex: structureEndIndex.value,
      levelOverrides,
    }),
  )

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

  return {
    structureStartIndex, structureEndIndex, committing, error,
    isRecalibration, commitLabel, bornesChanged, topLevelItems,
    toggleEnd, onLevelChange, onCommit,
  }
}
