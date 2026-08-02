import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// Respiration autour des pages en édition (px). Doit rester synchro avec le
// padding de .folio-scroll (fitScale la retire de la place disponible).
const EDIT_PAD = 40
// Respiration autour de la planche double-page (px), retirée de la place dispo.
const SPREAD_PAD = 12

// L'échelle du rendu Folio. `fitScale` ajuste sur la largeur (viser `visiblePages`)
// ET la hauteur — le plus contraignant l'emporte ; le `clientHeight` vient du flex
// parent (indépendant du contenu → pas de boucle de rétroaction d'échelle). Un
// ResizeObserver sur la racine relance le calcul. Les helpers DOM (rootRef,
// frameRef, frameDoc) restent chez FolioView et sont injectés.
// `onScaled` est notifié après chaque mise à l'échelle (le frame vient de changer
// de largeur/hauteur) : la CustomScrollbar qui enveloppe la rangée de pages en
// édition ne surveille pas le style inline du frame, il faut la remesurer.
export function useFolioScale(props, { rootRef, frameRef, frameDoc, onScaled }) {
  const scaleRef = ref(1)
  const scalePercent = computed(() => scaleRef.value * 100)

  // Applique l'échelle + les dimensions du frame, mais SEULEMENT si elles changent
  // vraiment (tolérance sub-pixel). `fitScale` peut être rappelé par le ResizeObserver
  // que ses propres écritures de `frame.style.*` réveillent, et la relecture de
  // `frame.style.width` est arrondie par le navigateur : sans cette garde, on
  // réécrivait à chaque fois une valeur « différente » → re-layout de l'iframe (qui
  // repeint son contenu avec une frame de retard) = clignotement. Idempotent → un seul
  // paint, et la boucle du ResizeObserver s'éteint d'elle-même (2e passe = no-op).
  // `pad` (px) : respiration RÉSERVÉE À L'INTÉRIEUR de la frame autour du contenu.
  // Sans elle, la frame collait au contenu → l'ombre portée des pages (dans l'iframe)
  // se faisait clipper à ses bords, surtout en bas (offset +1px) — la « couture »
  // coupée du vis-à-vis. On agrandit donc la frame de 2×pad et on décale `#render`
  // d'autant : les pages ne touchent plus les bords, l'ombre a la place de s'afficher.
  function applyScale(scale, contentW, contentH, pad = 0) {
    const frame = frameRef.value
    const render = frameDoc()?.getElementById('render')
    if (!frame || !render) return
    const frameW = contentW + 2 * pad
    const frameH = contentH + 2 * pad
    const curW = parseFloat(frame.style.width) || 0
    const curH = parseFloat(frame.style.height) || 0
    const skip = Math.abs(curW - frameW) < 0.5 && Math.abs(curH - frameH) < 0.5 && Math.abs(scaleRef.value - scale) < 0.0005
    if (skip) return
    scaleRef.value = scale
    render.style.transform = pad ? `translate(${pad}px, ${pad}px) scale(${scale})` : `scale(${scale})`
    frame.style.width = `${frameW}px`
    frame.style.height = `${frameH}px`
    onScaled?.()
  }

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
      // généreux autour des pages (EDIT_PAD, appliqué à .folio-pad) pour que la
      // page tienne DANS cette respiration. `clientHeight` vient du flex parent
      // (indépendant du contenu → pas de boucle).
      const availW = root.clientWidth - 2 * EDIT_PAD
      const availH = root.clientHeight - 2 * EDIT_PAD
      const scale = Math.min(
        availW / (pageEl.offsetWidth * props.visiblePages),
        availH / pageEl.offsetHeight,
        1,
      )
      applyScale(scale, rowW * scale, pageEl.offsetHeight * scale)
      return
    }

    if (props.mode === 'spread') {
      // Double-page : rangée HORIZONTALE de pages, FERRÉE À GAUCHE (comme l'édition) —
      // la 1re page ne bouge pas. L'échelle est calée sur `visiblePages` et la hauteur
      // du bandeau (toutes deux indépendantes du NOMBRE de pages) → taille de page
      // stable quel que soit le contenu. La frame fait toute la largeur de la rangée :
      // les pages au-delà de la planche d'ouverture sont RÉVÉLÉES par défilement
      // horizontal (plus de clip). SPREAD_PAD réservé DANS la frame pour l'ombre portée.
      const pagesArea = doc.querySelector('.pagedjs_pages')
      const rowW = pagesArea ? pagesArea.scrollWidth : pageEl.offsetWidth
      const availW = root.clientWidth - 2 * SPREAD_PAD
      const availH = root.clientHeight - 2 * SPREAD_PAD
      const scale = Math.min(availW / (pageEl.offsetWidth * props.visiblePages), availH / pageEl.offsetHeight, 1)
      applyScale(scale, rowW * scale, pageEl.offsetHeight * scale, SPREAD_PAD)
      return
    }

    const scale = Math.min(root.clientWidth / pageEl.offsetWidth, 1)
    applyScale(scale, pageEl.offsetWidth * scale, pageEl.offsetHeight * scale)
  }

  let resizeObserver = null
  onMounted(() => {
    resizeObserver = new ResizeObserver(fitScale)
    resizeObserver.observe(rootRef.value)
  })
  onBeforeUnmount(() => resizeObserver?.disconnect())

  return { scaleRef, scalePercent, fitScale }
}
