// Décor commun des options echarts (police, encres, grille, infobulle, filigrane). Les
// couleurs de SÉRIE restent dans les cards (domaine). Tout passe par cssVar : echarts
// peint dans un <canvas> où var() n'est pas résolu.
import { cssVar } from './theme'

const CAT_COUNT = 8

// Résolus une fois par construction d'option (pas une par série).
export function chartTokens() {
  return {
    ink: cssVar('--c-ink', '#1a1612'),
    ink2: cssVar('--c-ink2', '#5a5047'),
    muted: cssVar('--c-muted', '#8a7f72'),
    surface: cssVar('--c-paper', '#faf8f4'),
    border: cssVar('--c-border', '#e0d8cc'),
    font: cssVar('--font-ui', 'system-ui, sans-serif'),
  }
}

// Palette catégorielle du DS. Ordre fixe, jamais cyclé : au-delà de 8, l'appelant
// regroupe en « Autres ».
export function catColors() {
  return Array.from({ length: CAT_COUNT }, (_, i) => cssVar(`--c-cat-${i + 1}`))
}

// Filigrane : tuile de texte pivoté répétée en fond. En `backgroundColor` (motif canvas)
// et non `graphic` : reste derrière les marques sans arbitrer un `z`. Null hors navigateur.
export function watermarkPattern(text, { size = 220, opacity = 0.045 } = {}) {
  if (typeof document === 'undefined' || !text) return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  canvas.width = size
  canvas.height = size
  const { ink, font } = chartTokens()

  ctx.globalAlpha = opacity
  ctx.fillStyle = ink
  ctx.font = `600 20px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.translate(size / 2, size / 2)
  ctx.rotate(-Math.PI / 8)
  // Tronqué : un titre long ferait une tuile illisible et bruyante.
  ctx.fillText(text.length > 28 ? `${text.slice(0, 27)}…` : text, 0, 0)

  return { image: canvas, repeat: 'repeat' }
}

// Décor commun d'un graphe. `watermark` : le texte du filigrane (le titre du
// livre, en général) — omis, pas de fond.
export function baseOption({ watermark = null, grid = {} } = {}) {
  const t = chartTokens()
  const background = watermarkPattern(watermark)

  return {
    ...(background ? { backgroundColor: background } : {}),
    textStyle: { fontFamily: t.font, color: t.ink2 },
    // Grille recessive : la donnée passe devant, pas le cadre.
    grid: { left: 4, right: 12, top: 24, bottom: 4, containLabel: true, ...grid },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.border,
      textStyle: { color: t.ink, fontFamily: t.font, fontSize: 12 },
      extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,.12);',
    },
  }
}

// Axe (valeur ou catégorie) au décor commun : ligne et graduations effacées,
// étiquettes à l'encre du texte — jamais à la couleur d'une série.
export function axisDecor(tokens = chartTokens()) {
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: tokens.ink, fontFamily: tokens.font, fontSize: 12 },
    splitLine: { lineStyle: { color: tokens.border, type: 'dashed' } },
  }
}
