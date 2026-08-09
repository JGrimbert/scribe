import { ref, computed, watch } from 'vue'
import { effectivePage, effectiveMargins } from '../script/pageFormats'
import { fragmentPages } from '../script/searchFragment'

// Alimentation de l'UNIQUE FolioView persistant + géométrie qu'il émet en retour.
export function useMaquetteFolio({
  fmtPage, styleDefaults, searching, focusedSourceKey, isFormat, isLiminaire,
  limFocusedSpread, pouring, pageFragments, activeNeedle, pourTitle, resultOffset,
  statItems, modelNodeId, focusedSection, limFocused, focused,
}) {
  const spreadGeometry = ref(null)
  const blockGeometry = ref([])
  const styleGeometry = ref({})

  // Le FolioView repagine en asynchrone ET fait glisser la planche (~320 ms), dans un
  // ordre quelconque : les scènes et fuyantes ne se posent qu'une fois les DEUX finis,
  // sinon un scroll rapide les colle sur l'ancien contenu ou d'anciennes ancres. D'où
  // deux signaux — contenu paginé (contentFresh) ET glissement terminé (lastAnimating).
  const contentFresh = ref(false)
  const lastAnimating = ref(false)
  const geometryStale = computed(() => !contentFresh.value || lastAnimating.value)
  const searchLayout = computed(() => searching.value && !geometryStale.value)
  const annotationsLayout = computed(() => focusedSourceKey.value === 'validation' && !geometryStale.value)

  function onSpreadGeometry(geometry) {
    spreadGeometry.value = geometry
    lastAnimating.value = !!geometry?.animating
  }
  function onPaginated() {
    contentFresh.value = true
  }

  const analyseLeft = computed(() => {
    const p = spreadGeometry.value?.pages?.[0]
    return p ? `${Math.round(p.left + p.width)}px` : '40%'
  })
  const analyseColumn = computed(() => {
    const period = spreadGeometry.value?.period
    return period ? `${Math.round(period)}px` : '22em'
  })

  const previewPage = computed(() => effectivePage(fmtPage.value, styleDefaults.pageSize))
  const previewMargins = computed(() => ({ ...effectiveMargins(fmtPage.value, styleDefaults.pageMargins) }))
  const previewRunningTitles = computed(() => JSON.parse(JSON.stringify(styleDefaults.runningTitles)))

  const SEARCH_MARGINS = { topCm: 0, bottomCm: 0, innerCm: 0, outerCm: 0 }
  const formatSpreadPages = [{ kind: 'empty' }, { kind: 'empty' }]

  function limSlotFor(cell) {
    if (!cell) return { kind: 'cover', label: 'Page de garde' }
    if (cell.cover) return { kind: 'cover', label: 'Page de garde' }
    if (cell.blank) return { kind: 'blank', label: cell.implicit ? 'blanche · parité' : 'Page blanche' }
    return { kind: 'content', entries: cell.page?.entries ?? [] }
  }
  const limSpreadPages = computed(() => {
    const s = limFocusedSpread.value
    return s ? [limSlotFor(s.left), limSlotFor(s.right)] : []
  })

  const mainSpreadPages = computed(() => {
    if (pouring.value) {
      return fragmentPages(pageFragments.value, activeNeedle.value, {
        status: pourTitle.value,
        stats: searching.value ? statItems.value : undefined,
        offset: resultOffset.value,
      })
    }
    if (isFormat.value) return formatSpreadPages
    if (isLiminaire.value) return limSpreadPages.value
    return null
  })

  const mainNodeId = computed(() => modelNodeId.value)
  const mainDepth = computed(() =>
    focusedSourceKey.value === 'chapitrage' ? (focusedSection.value?.depthKey ?? 0) : 0,
  )

  // Périmer le rendu à toute nav qui change ce que rend la planche. PAS le zoom (glisse
  // sans changer le contenu), ni la pagination des résultats, ni les réglages de format.
  watch(
    () => [focusedSourceKey.value, limFocused.value, mainNodeId.value, mainDepth.value],
    () => { contentFresh.value = false },
  )

  const previewRatio = computed(() => {
    const p = previewPage.value
    return p && p.widthCm && p.heightCm ? p.widthCm / p.heightCm : 148 / 210
  })

  const chapSpreadStyles = computed(() => Object.keys(styleGeometry.value).map((name) => ({ name })))

  const hoveredStyle = ref(null)
  watch(focused, () => { hoveredStyle.value = null })
  const setHoveredStyle = (name) => { hoveredStyle.value = name }

  return {
    spreadGeometry, blockGeometry, styleGeometry,
    geometryStale, searchLayout, annotationsLayout,
    onSpreadGeometry, onPaginated,
    analyseLeft, analyseColumn,
    previewPage, previewMargins, previewRunningTitles, previewRatio,
    SEARCH_MARGINS,
    mainSpreadPages, mainNodeId, mainDepth,
    chapSpreadStyles, hoveredStyle, setHoveredStyle,
  }
}
