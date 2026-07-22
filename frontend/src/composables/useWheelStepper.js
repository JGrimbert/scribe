import { watch } from 'vue'

// Molette : le liminaire se parcourt à l'horizontale, un cran par palier franchi.
// Un pavé tactile émet ~40 événements/s ; sans seuil d'accumulation, un seul geste
// traverserait tout le liminaire.
//
// `slideCount`/`focused` : refs (ou computeds). `onStep(next)` : appelé avec le
// cran visé. Le composant garde `@wheel.prevent` sur la scène pour bloquer le
// défilement natif.
export function useWheelStepper({ slideCount, focused, onStep }) {
  const WHEEL_STEP = 60
  let wheelAcc = 0

  // Cran visé par le dernier `onStep` non encore répercuté. Sans lui, plusieurs
  // événements du MÊME tick liraient tous le `focused` d'avant — un geste vif de
  // pavé tactile n'avancerait que d'un cran au lieu de plusieurs. Remis à zéro dès
  // que la valeur rattrape, ce qui le rend auto-réparant si le parent refuse le
  // déplacement.
  let wheelTarget = null
  watch(focused, () => { wheelTarget = null })

  function onWheel(event) {
    // `deltaX` autant que `deltaY` : molette verticale classique comme geste
    // horizontal du pavé tactile, les deux disent « au suivant ».
    wheelAcc += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (Math.abs(wheelAcc) < WHEEL_STEP) return
    const dir = Math.sign(wheelAcc)
    wheelAcc = 0
    const from = wheelTarget ?? focused.value
    const next = Math.min(slideCount.value - 1, Math.max(0, from + dir))
    if (next === from) return
    wheelTarget = next
    onStep(next)
  }

  return { onWheel }
}
