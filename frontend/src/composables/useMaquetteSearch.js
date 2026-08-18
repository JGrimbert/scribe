import { ref, computed, watch, onUnmounted } from 'vue'
import { useDocSearch } from './useDocSearch'
import { useAnnotations } from './useAnnotations'

// Versage en lambeaux du folio persistant, pour deux sources : recherche (jalon de
// tête) et annotations (dernier jalon). Seul le rendu folio est mutualisé (cf.
// useMaquetteFolio) ; le contenu/pagination vit ici.
export function useMaquetteSearch({ searching, focusedSourceKey, highlights }) {
  // Saisie débouncée : chaque changement repagine l'iframe (plusieurs dizaines de ms).
  const searchQuery = ref('')
  const QUERY_DEBOUNCE = 220
  let queryTimer = null
  function onQuery(q) {
    clearTimeout(queryTimer)
    queryTimer = setTimeout(() => {
      searchQuery.value = q
      resultPage.value = 0
    }, QUERY_DEBOUNCE)
  }
  onUnmounted(() => clearTimeout(queryTimer))

  const { fragments: searchFragments, fragmentTotal: searchTotal } = useDocSearch(() => searchQuery.value)

  const { passages: annotationPassages, charCounts: annotationCharCounts } = useAnnotations(() => highlights)
  const mutedColors = ref([])
  function toggleMutedColor(color) {
    const i = mutedColors.value.indexOf(color)
    if (i === -1) mutedColors.value.push(color)
    else mutedColors.value.splice(i, 1)
  }
  const shownPassages = computed(() => annotationPassages.value.filter((p) => !mutedColors.value.includes(p.color)))

  const pouring = computed(() => searching.value || focusedSourceKey.value === 'validation')
  const activeFragments = computed(() => (searching.value ? searchFragments.value : shownPassages.value))
  const activeTotal = computed(() => (searching.value ? searchTotal.value : shownPassages.value.length))
  const activeNeedle = computed(() => (searching.value ? searchQuery.value : ''))

  // Résultats paginés en amont, UN lambeau par page (page unique élargie des vues frag,
  // cf. useMaquetteFolio / fragmentPages) : un large lambeau plein cadre à la fois.
  // Couler des milliers de passages dans Paged.js figerait l'écran ; le compte annoncé
  // reste le vrai total.
  const RESULTS_PER_PAGE = 1
  const resultPage = ref(0)
  const resultPageCount = computed(() => Math.max(1, Math.ceil(activeTotal.value / RESULTS_PER_PAGE)))
  const resultOffset = computed(() => resultPage.value * RESULTS_PER_PAGE)
  const pageFragments = computed(() =>
    activeFragments.value.slice(resultOffset.value, resultOffset.value + RESULTS_PER_PAGE),
  )

  watch([searching, () => mutedColors.value.length], () => { resultPage.value = 0 })

  function stepResultPage(dir) {
    resultPage.value = Math.min(Math.max(resultPage.value + dir, 0), resultPageCount.value - 1)
  }

  watch(resultPageCount, (n) => { if (resultPage.value > n - 1) resultPage.value = n - 1 })

  const pourTitle = computed(() => {
    const base = `${searching.value ? 'Résultats' : 'Annotations'} : ${activeTotal.value}`
    return resultPageCount.value > 1 ? `${base} · page ${resultPage.value + 1}/${resultPageCount.value}` : base
  })

  return {
    searchQuery, onQuery,
    pouring, activeFragments, activeTotal, activeNeedle,
    resultPage, resultPageCount, resultOffset, pageFragments, stepResultPage, pourTitle,
    mutedColors, toggleMutedColor, shownPassages, annotationCharCounts,
  }
}
