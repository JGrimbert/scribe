import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// Respiration autour des pages en édition (px). Doit rester synchro avec le
// padding de .folio-scroll (fitScale la retire de la place disponible).
const EDIT_PAD = 40

// L'échelle du rendu Folio. `fitScale` ajuste sur la largeur (viser `visiblePages`)
// ET la hauteur — le plus contraignant l'emporte ; le `clientHeight` vient du flex
// parent (indépendant du contenu → pas de boucle de rétroaction d'échelle). Un
// ResizeObserver sur la racine relance le calcul. Les helpers DOM (rootRef,
// frameRef, frameDoc) restent chez FolioView et sont injectés.
export function useFolioScale(props, { rootRef, frameRef, frameDoc }) {
  const scaleRef = ref(1)
  const scalePercent = computed(() => scaleRef.value * 100)

  function fitScale() {
    const doc = frameDoc()
    const pageEl = doc?.querySelector('.pagedjs_page')
    const render = doc?.getElementById('render')
    const frame = frameRef.value
    const root = rootRef.value
    if (!pageEl || !render || !frame || !root) return

    if (props.mode === 'edit') {
      const pagesArea = doc.querySelector('.pagedjs_pages')
      const rowW = pagesArea ? pagesArea.scrollWidth : pageEl.offsetWidth
      // Ajusté sur la largeur (viser `visiblePages`) ET la hauteur (une page tient
      // verticalement) — le plus contraignant l'emporte. On retire le padding
      // généreux autour des pages (EDIT_PAD, appliqué à .folio-scroll) pour que la
      // page tienne DANS cette respiration. `clientHeight` vient du flex parent
      // (indépendant du contenu → pas de boucle).
      const availW = root.clientWidth - 2 * EDIT_PAD
      const availH = root.clientHeight - 2 * EDIT_PAD
      const scale = Math.min(
        availW / (pageEl.offsetWidth * props.visiblePages),
        availH / pageEl.offsetHeight,
        1,
      )
      scaleRef.value = scale
      render.style.transform = `scale(${scale})`
      frame.style.width = `${rowW * scale}px`
      frame.style.height = `${pageEl.offsetHeight * scale}px`
      return
    }

    const scale = Math.min(root.clientWidth / pageEl.offsetWidth, 1)
    scaleRef.value = scale
    render.style.transform = `scale(${scale})`
    frame.style.width = `${pageEl.offsetWidth * scale}px`
    frame.style.height = `${pageEl.offsetHeight * scale}px`
  }

  let resizeObserver = null
  onMounted(() => {
    resizeObserver = new ResizeObserver(fitScale)
    resizeObserver.observe(rootRef.value)
  })
  onBeforeUnmount(() => resizeObserver?.disconnect())

  return { scaleRef, scalePercent, fitScale }
}
