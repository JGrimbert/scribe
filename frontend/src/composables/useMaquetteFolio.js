import { ref, computed, watch } from 'vue'
import { effectivePage, effectiveMargins } from '../script/pageFormats'
import { fragmentPages } from '../script/searchFragment'

// Alimentation de l'UNIQUE FolioView persistant + géométrie qu'il émet en retour.
export function useMaquetteFolio({
  fmtPage, styleDefaults, searching, focusedSourceKey, isFormat, isLiminaire,
  limFocusedSpread, pouring, pageFragments, activeNeedle, pourTitle, resultOffset,
  statItems, modelNodeId, focusedSection, limFocused, focused,
  tornActive, tornPages,
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

  // Colonne « en regard » (nuage / validation), en fraction de la période de trame (=
  // la page large + ses marges). Les vues frag tiennent sur UNE page unique élargie ;
  // la scène se contente d'une colonne RÉDUITE à sa droite. Réservée aussi dans
  // `visible-pages` (cf. MaquetteView) pour que la page large tienne entière à côté.
  // À régler à l'œil (fraction d'une période DÉJÀ deux fois plus large qu'une page).
  const SCENE_COL = 0.35

  // Bord droit de la (dernière) page : la scène se pose après elle.
  const analyseLeft = computed(() => {
    const pages = spreadGeometry.value?.pages
    const p = pages?.[pages.length - 1]
    return p ? `${Math.round(p.left + p.width)}px` : '60%'
  })
  const analyseColumn = computed(() => {
    const period = spreadGeometry.value?.period
    return period ? `${Math.round(period * SCENE_COL)}px` : '16em'
  })

  const previewPage = computed(() => effectivePage(fmtPage.value, styleDefaults.pageSize))

  // Vues frag : une page UNIQUE plus large (largeur ×POUR_WIDTH_FACTOR), hauteur et
  // marges du livre inchangées → gouttières verticales et bandes tête/pied intactes,
  // seule la largeur du paged change. Ailleurs, la page du livre telle quelle.
  // (Réglage à l'œil : ~4/3 fait une page « large » sans dominer l'écran.)
  const POUR_WIDTH_FACTOR = 4 / 3
  const mainPage = computed(() => {
    const p = previewPage.value
    // L'aperçu déchiré garde la LARGEUR livre (feuilles fidèles, échelle lisible) ; seuls
    // les lambeaux de recherche/annotations élargissent la page.
    if (!pouring.value || tornActive?.value || !p?.widthCm) return p
    return { ...p, widthCm: p.widthCm * POUR_WIDTH_FACTOR }
  })
  const previewMargins = computed(() => ({ ...effectiveMargins(fmtPage.value, styleDefaults.pageMargins) }))
  const previewRunningTitles = computed(() => JSON.parse(JSON.stringify(styleDefaults.runningTitles)))

  // Ratio période-large / période-livre (largeur de page + marges horizontales). Sert à
  // CALIBRER l'échelle des vues frag sur celle des vues à vis-à-vis : on y réserve le
  // MÊME empan, exprimé en périodes-LIVRE, converti ici en périodes de la page LARGE
  // (l'unité de `visible-pages`). Sans ça, la page large — bornée par la HAUTEUR —
  // grossirait pour remplir la vue au lieu de garder l'échelle de Format (px/cm).
  const pourPeriodRatio = computed(() => {
    const p = previewPage.value
    const m = previewMargins.value
    const hM = (m.innerCm ?? 0) + (m.outerCm ?? 0)
    const periodBook = (p?.widthCm ?? 0) + hM
    return periodBook > 0 ? ((p.widthCm * POUR_WIDTH_FACTOR) + hM) / periodBook : 1
  })

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
    // Aperçu déchiré : ses pages fidèles priment (elles n'ont pas de statut ni de
    // pagination amont — un lambeau par page, molette pour défiler).
    if (tornActive?.value) return tornPages.value
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
    () => [focusedSourceKey.value, limFocused.value, mainNodeId.value, mainDepth.value, tornActive?.value],
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
    SCENE_COL, mainPage, pourPeriodRatio,
    mainSpreadPages, mainNodeId, mainDepth,
    chapSpreadStyles, hoveredStyle, setHoveredStyle,
  }
}
