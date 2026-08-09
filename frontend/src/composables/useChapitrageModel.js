import { ref, computed, watch, inject, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { nodesAtDepthKey, firstNodeAtDepthKey } from '../script/chapitrageNodes'
import { modelStyleNames } from '../script/chapitrageModele'
import { levelConstraints, tallyByDepth } from '../script/chapitrageValidation'
import { groupByDeviation } from '../script/chapitrageGroupes'
import { mergeCandidates, corpsMergeCandidates, deviationStyleRows } from '../script/chapitrageFusion'

// Modèle de chapitrage : nœud témoin d'un niveau, décompte validable/validé, et
// validation (familles d'écart au modèle + fusions de styles). `chapSections` vient
// d'amont (le film en construit ses crans).
export function useChapitrageModel({
  trame, documentData, chapSections, rules, structureShapes,
  styles, stylePrecedence, focusedCran, searching, load,
}) {
  const route = useRoute()
  const reloadDocument = inject('reloadDocument', null)
  const validations = inject('documentValidations', null)

  const axes = () => trame?.value?.axes ?? []
  const data = () => documentData?.value

  const focusedSection = computed(() => {
    const cran = focusedCran.value
    if (cran?.sourceKey !== 'chapitrage') return null
    return chapSections.value[cran.sectionIndex] ?? null
  })

  const shapeByNode = computed(() => new Map(structureShapes.value.map((s) => [s.nodeId, s])))
  const titleStyleOf = (nodeId) => data()?.[nodeId]?.styleName ?? null

  function modelNamesAt(depthKey) {
    const nodeId = firstNodeAtDepthKey(axes(), data(), depthKey)
    return nodeId ? modelStyleNames(shapeByNode.value.get(nodeId) ?? null, titleStyleOf(nodeId)) : []
  }

  // Nœud de référence du niveau = toujours son premier nœud (rendu par l'aperçu témoin).
  const modelNodeId = computed(() => {
    if (focusedCran.value?.sourceKey !== 'chapitrage') return null
    const dk = focusedSection.value?.depthKey
    return dk == null ? null : firstNodeAtDepthKey(axes(), data(), dk)
  })

  const constraintsByDepth = computed(() =>
    Object.fromEntries(
      chapSections.value.map((sec) => [sec.depthKey, levelConstraints(sec.ruleSet ?? rules.default, modelNamesAt(sec.depthKey))]),
    ),
  )

  const chapTally = computed(() =>
    tallyByDepth(structureShapes.value, {
      constraintsByDepth: constraintsByDepth.value,
      titleStyleOf,
      validations: validations?.value ?? {},
    }),
  )

  const chapTallyRows = computed(() =>
    chapSections.value.map((sec, index) => ({
      index,
      label: `Chapitrage n°${index + 1}`,
      depthKey: sec.depthKey,
      fromModel: constraintsByDepth.value[sec.depthKey]?.fromModel ?? true,
      ...(chapTally.value[sec.depthKey] ?? { total: 0, validables: 0, valides: 0, perimes: 0 }),
    })),
  )

  const activeTallyRow = computed(() =>
    focusedCran.value?.sourceKey === 'chapitrage'
      ? (chapTallyRows.value[focusedCran.value.sectionIndex] ?? null)
      : null,
  )

  const validating = ref(false)
  function toggleValidation() {
    validating.value = !validating.value
  }

  const levelNodes = computed(() => {
    const dk = focusedSection.value?.depthKey
    if (dk == null) return null
    return nodesAtDepthKey(axes(), data(), dk).map((n) => ({ ...n, shape: shapeByNode.value.get(n.nodeId) ?? null }))
  })

  const deviationGroups = computed(() =>
    levelNodes.value ? groupByDeviation(levelNodes.value, modelNamesAt(focusedSection.value.depthKey), titleStyleOf) : [],
  )

  const showGroupes = computed(() => validating.value && !searching.value && !!deviationGroups.value.length)

  const HOVER_DEBOUNCE = 40
  const hoveredGroup = ref(null)
  let hoverTimer = null
  function onHoverGroup(group) {
    clearTimeout(hoverTimer)
    hoverTimer = setTimeout(() => { hoveredGroup.value = group }, HOVER_DEBOUNCE)
  }
  const hoveredNode = computed(() => {
    const id = hoveredGroup.value?.nodes[0]?.nodeId
    return id ? data()?.[id] ?? null : null
  })

  const mergeSuggestion = computed(() => {
    const dk = focusedSection.value?.depthKey
    if (dk == null || !showGroupes.value) return null
    return mergeCandidates(levelNodes.value, modelNamesAt(dk), titleStyleOf).find((c) => c.gain > 0) ?? null
  })

  // Doublon de corps : invisible à mergeCandidates (mêmes rangs, coprésents), trahi par
  // le rôle partagé. Ne se déclenche que si les deux styles sont typés `corps`.
  const roleOf = (name) => styles[name] ?? '?'
  const corpsSuggestion = computed(() => {
    const dk = focusedSection.value?.depthKey
    if (dk == null || !showGroupes.value) return null
    return corpsMergeCandidates(levelNodes.value, roleOf, modelNamesAt(dk), titleStyleOf).find((c) => c.collapsed > 0) ?? null
  })

  const styleRows = computed(() => {
    const dk = focusedSection.value?.depthKey
    if (dk == null || !showGroupes.value) return []
    return deviationStyleRows(levelNodes.value, roleOf, modelNamesAt(dk), titleStyleOf)
  })

  const merging = ref(false)

  // La fusion réécrit le document en base et ne se souvient de rien (une recalibration
  // ramènera les deux styles) : d'où la confirmation.
  async function applyMerge({ keep, drop, droppedCount }) {
    const ok = window.confirm(
      `Fondre « ${drop} » dans « ${keep} » ? ${droppedCount} chapitres seront réécrits.\n\n`
      + 'Le style « ' + drop + ' » disparaîtra du document. L\'opération n\'est pas annulable, '
      + 'et une recalibration depuis le .odt ramènera les deux styles.',
    )
    if (!ok) return
    merging.value = true
    try {
      const res = await fetch(`/api/documents/${route.params.id}/styles/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep, drop }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // La map des rôles est fusionnée au chargement (pas remplacée) : sans ce retrait,
      // le style fondu y survivrait et la prochaine sauvegarde le réintroduirait.
      delete styles[drop]
      delete stylePrecedence[drop]
      await Promise.all([load(route.params.id), reloadDocument?.()])
    } catch (e) {
      window.alert(`Fusion impossible : ${e.message}`)
    } finally {
      merging.value = false
    }
  }

  watch([showGroupes, deviationGroups], () => {
    clearTimeout(hoverTimer)
    hoveredGroup.value = null
  })
  onUnmounted(() => clearTimeout(hoverTimer))

  return {
    focusedSection, modelNodeId, titleStyleOf,
    activeTallyRow, chapTallyRows,
    validating, toggleValidation,
    levelNodes, deviationGroups, showGroupes,
    hoveredGroup, onHoverGroup, hoveredNode,
    mergeSuggestion, corpsSuggestion, styleRows, merging, applyMerge,
  }
}
