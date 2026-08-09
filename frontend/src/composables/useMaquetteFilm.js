import { ref, computed, watch } from 'vue'
import { depthKeyOf } from '../script/chapitrageNodes'

// Pellicule de la maquette : focus/navigation partagés par dock, sommaire et aperçu.
// `focused` (index dans la liste plate `crans`) est la SoT interne ; la route ne
// reflète que le jalon (cf. useMaquetteRoute).
export function useMaquetteFilm({ layers, limSpreads, chapSections, bookTitle, trame }) {
  const focused = ref(0)

  const series = computed(() => {
    const out = []
    out.push({
      key: 'vocabulaire',
      label: bookTitle.value || 'Le livre',
      spreads: layers.value.map((l, i) => ({
        sourceKey: 'analyse', analyseKey: l.key, analyseLabel: l.label, wheelSkip: i > 0,
      })),
    })
    out.push({ key: 'format', label: 'Format', spreads: [{ sourceKey: 'maquette' }] })
    const sp = limSpreads.value
    out.push({
      key: 'liminaire',
      label: 'Liminaire',
      spreads: (sp.length ? sp : [null]).map((_, i) => ({ sourceKey: 'liminaire', spreadIndex: i })),
    })
    chapSections.value.forEach((sec, i) => {
      out.push({
        key: `chap-${i}`,
        label: `Chapitrage n°${i + 1}`,
        spreads: [{ sourceKey: 'chapitrage', sectionIndex: i, depthKey: sec.depthKey }],
      })
    })
    out.push({ key: 'validation', label: 'Validation', spreads: [{ sourceKey: 'validation' }] })
    return out
  })

  function sectionOf(seriesKey) {
    if (seriesKey === 'vocabulaire') return { key: 'vocabulaire', label: bookTitle.value || 'Le livre' }
    if (seriesKey === 'format') return { key: 'format', label: 'Format' }
    if (seriesKey === 'liminaire') return { key: 'liminaire', label: 'Liminaire' }
    if (seriesKey === 'validation') return { key: 'annotations', label: 'Annotations' }
    return { key: 'chapitrage', label: 'Chapitrage' }
  }

  const crans = computed(() => {
    const out = []
    let prevSection = null
    series.value.forEach((s, si) => {
      const sec = sectionOf(s.key)
      s.spreads.forEach((sp) => {
        const isSectionStart = sec.key !== prevSection
        prevSection = sec.key
        out.push({
          ...sp, seriesIndex: si, seriesKey: s.key, seriesLabel: s.label,
          sectionKey: sec.key, sectionLabel: sec.label, isSectionStart,
        })
      })
    })
    return out
  })

  const focusedCran = computed(() => crans.value[focused.value] ?? null)
  const focusedSourceKey = computed(() => focusedCran.value?.sourceKey ?? null)

  const isFormat = computed(() => focusedSourceKey.value === 'maquette')
  const isLiminaire = computed(() => focusedSourceKey.value === 'liminaire')
  const isChapitrage = computed(() => focusedSourceKey.value === 'chapitrage')
  const searching = computed(() => focusedSourceKey.value === 'analyse')

  const folds = ref({})
  const sectionKeys = computed(() => [...new Set(crans.value.map((c) => c.sectionKey))])
  const focusedZoneKey = computed(() => focusedCran.value?.sectionKey ?? null)

  function applyAutoFolds() {
    folds.value = Object.fromEntries(
      sectionKeys.value.map((k) => [k, k === focusedZoneKey.value ? 'open' : 'tab']),
    )
  }

  // Deps volontairement étroites : réappliquer sur `sectionKeys` lui-même écraserait
  // un pli posé à la main (ce computed se recrée à chaque recomposition des crans).
  watch([focusedZoneKey, () => sectionKeys.value.join('|')], applyAutoFolds, { immediate: true })

  const vocabIndex = computed(() => crans.value.findIndex((c) => c.sourceKey === 'analyse'))
  const afterAnalyseIndex = computed(() => {
    const i = crans.value.findIndex((c) => c.sourceKey !== 'analyse')
    return i === -1 ? crans.value.length - 1 : i
  })
  function enterSearch() {
    if (vocabIndex.value !== -1) focused.value = vocabIndex.value
  }
  function exitSearch() {
    if (searching.value) focused.value = afterAnalyseIndex.value
  }

  const parts = computed(() =>
    series.value.filter((s) => s.key !== 'vocabulaire').map((s) => ({ key: s.key, label: s.label })),
  )

  function focusSeries(seriesKey) {
    const i = crans.value.findIndex((c) => c.seriesKey === seriesKey)
    if (i !== -1) focused.value = i
  }

  // Verrou temporel : un « flick » de molette émet plusieurs events, on n'en retient
  // qu'un le temps de l'animation.
  let wheelLock = false
  function onAsideWheel(e) {
    if (wheelLock) return
    const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0
    if (!dir) return
    const keys = series.value.map((s) => s.key)
    const cur = keys.indexOf(focusedCran.value?.seriesKey)
    const next = Math.min(Math.max(cur + dir, 0), keys.length - 1)
    if (next === cur) return
    focusSeries(keys[next])
    wheelLock = true
    setTimeout(() => { wheelLock = false }, 450)
  }

  function selectNode(nodeId) {
    const i = chapSections.value.findIndex((s) => s.depthKey === depthKeyOf(trame?.value?.axes ?? [], nodeId))
    if (i !== -1) focusSeries(`chap-${i}`)
  }

  const limStart = computed(() => crans.value.findIndex((c) => c.sourceKey === 'liminaire'))
  const limFocused = computed(() =>
    focusedSourceKey.value === 'liminaire' ? Math.max(0, focused.value - limStart.value) : 0,
  )
  function setLimFocused(localIndex) {
    const last = Math.max(0, limSpreads.value.length - 1)
    focused.value = limStart.value + Math.min(Math.max(localIndex, 0), last)
  }
  const limFocusedSpread = computed(() => limSpreads.value[limFocused.value] ?? null)

  return {
    focused, series, crans, focusedCran, focusedSourceKey,
    isFormat, isLiminaire, isChapitrage, searching,
    folds, sectionKeys,
    vocabIndex, afterAnalyseIndex, enterSearch, exitSearch,
    parts, focusSeries, onAsideWheel, selectNode,
    limStart, limFocused, setLimFocused, limFocusedSpread,
  }
}
