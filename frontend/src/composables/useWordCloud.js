import { onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { forceSimulation, forceX, forceY } from 'd3-force'
import { loadLayout, saveLayout, signature } from '../script/layoutCache'
import {
  CLOUD_W,
  CLOUD_H,
  CLOUD_MARGIN,
  fitScale,
  placeWords,
  wordColor,
} from '../script/cloudLayout'

// Rappel des mots vers leur position « maison » (posée par d3-cloud).
const HOME_STRENGTH = 0.2
const VELOCITY_DECAY = 0.72
// Repoussement radial déclenché au clic. Amplitude et durée sont relatives au
// nombre de mots (cf. buildFromLayout) : à beaucoup de mots chaque frame coûte
// plus cher, on joue donc une animation plus courte et plus discrète.
const REHEAT_ALPHA = 0.6
const PUSH_RANGE = 180
const PUSH_STRENGTH_REF = 7
const REHEAT_DECAY_REF = 0.05
const REF_WORDS = 80

// États exclusifs (jamais cumulés) : actif > survol > normal.
const SCALE_HOVER = 1.05
const SCALE_ACTIVE = 1.05

// Nuage de mots animé. `words` est une source réactive de lemmes filtrés
// ({ lemma, count }, déjà tronquée) ; `onSettle` signale que l'entrée est jouée
// (chaîne de révélation du dashboard).
export function useWordCloud(words, onSettle) {
  const route = useRoute()

  const placed = ref([])
  const selected = ref(null)
  const hovered = ref(null)

  let sim = null
  let simNodes = []
  // Recalculés par layout selon le nombre de mots.
  let pushStrength = PUSH_STRENGTH_REF
  let reheatDecay = REHEAT_DECAY_REF

  function stopSim() {
    sim?.stop()
    sim = null
  }
  onUnmounted(stopSim)

  // Le mot sélectionné pousse tous les autres, intensité décroissant avec la
  // distance (diffusion douce). Lit simNodes/pushStrength par fermeture — donc
  // toujours l'état du layout courant.
  function radialPush(alpha) {
    const src = selected.value ? simNodes.find((n) => n.text === selected.value) : null
    if (!src) return
    for (const n of simNodes) {
      if (n === src) continue
      const dx = n.x - src.x
      const dy = n.y - src.y
      const d = Math.hypot(dx, dy) || 1
      const f = ((pushStrength * PUSH_RANGE) / (d + PUSH_RANGE)) * alpha
      n.vx += (dx / d) * f
      n.vy += (dy / d) * f
    }
  }

  function reheat() {
    sim?.alpha(REHEAT_ALPHA).alphaDecay(reheatDecay).restart()
  }

  function buildFromLayout(out) {
    const maxCount = out.reduce((m, w) => Math.max(m, w.count), 1)
    simNodes = out.map((w) => ({
      text: w.text,
      count: w.count,
      size: w.size,
      color: wordColor(w.count, maxCount),
      hx: w.x,
      hy: w.y,
      x: w.x,
      y: w.y,
    }))

    // Animation relative au nombre de mots : plus il y en a, plus le
    // repoussement est discret (÷ charge) et court (décroissance ∝ charge).
    const load = Math.max(0.5, simNodes.length / REF_WORDS)
    pushStrength = PUSH_STRENGTH_REF / load
    reheatDecay = Math.min(0.14, REHEAT_DECAY_REF * load)

    sim = forceSimulation(simNodes)
      .velocityDecay(VELOCITY_DECAY)
      .force('x', forceX((d) => d.hx).strength(HOME_STRENGTH))
      .force('y', forceY((d) => d.hy).strength(HOME_STRENGTH))
      .force('radial', radialPush)
      .stop()

    placed.value = simNodes.slice()
    sim.on('tick', () => {
      placed.value = simNodes.slice()
    })

    // Sélection du mot le plus fréquent → anime l'entrée du nuage.
    const top = out.reduce((m, w) => (w.count > m.count ? w : m), out[0])
    selected.value = top?.text ?? null
    reheat()

    // Entrée jouée → la card suivante peut apparaître.
    onSettle?.()
  }

  async function rebuild(list) {
    stopSim()
    if (!list.length) {
      simNodes = []
      placed.value = []
      onSettle?.()
      return
    }
    // Le contenu du nuage suffit à identifier le layout (mêmes lemmes/comptes →
    // même disposition) : pas besoin d'y ajouter le nombre de mots.
    const sig = signature(list.map((w) => `${w.lemma}:${w.count}`).join('|') + `|${CLOUD_W}x${CLOUD_H}`)
    const cached = loadLayout('cloud', route.params.id, sig)
    if (cached) {
      buildFromLayout(cached)
      return
    }
    const data = await placeWords(list, { scale: fitScale(list) })
    // Le vocabulaire a pu changer pendant le placement asynchrone.
    if (words.value !== list) return
    saveLayout('cloud', route.params.id, sig, data)
    buildFromLayout(data)
  }

  watch(words, rebuild, { immediate: true })
  // Seul le CLIC (changement de sélection) relance le repoussement.
  watch(selected, reheat)

  function toggle(text) {
    selected.value = selected.value === text ? null : text
  }

  function wordStyle(word) {
    const isActive = word.text === selected.value
    const grow = isActive ? SCALE_ACTIVE : word.text === hovered.value ? SCALE_HOVER : 1
    return {
      fontSize: `${word.size * grow}px`,
      fontWeight: isActive ? 700 : 400,
      fill: word.color,
    }
  }

  return { placed, selected, hovered, toggle, wordStyle, CLOUD_W, CLOUD_H, CLOUD_MARGIN }
}
