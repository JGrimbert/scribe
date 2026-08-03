// Socle commun des options echarts : le DÉCOR (police, encres, grille, infobulle,
// filigrane), que chaque card recopiait à l'identique. Les décisions de couleur de
// SÉRIE restent dans les cards — c'est du domaine (rampe ordinale vs catégorielle,
// cf. components/analyse/CLAUDE.md) ; ici on ne sert que le cadre.
//
// Tout passe par `cssVar` : echarts peint dans un <canvas>, où `var(--…)` n'est
// jamais résolu.
import { cssVar } from './theme'

const CAT_COUNT = 8

// Les tokens du décor, résolus une fois par construction d'option (une lecture de
// getComputedStyle par appel, pas une par série).
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

// Palette catégorielle du DS, résolue. Ordre FIXE et jamais cyclé : au-delà de 8
// identités, l'appelant regroupe en « Autres » (cf. base.css).
export function catColors() {
  return Array.from({ length: CAT_COUNT }, (_, i) => cssVar(`--c-cat-${i + 1}`))
}

// Filigrane : une tuile de texte pivoté, répétée en fond de grille. Rendu comme
// `backgroundColor` (motif canvas) et non comme `graphic` — le motif reste
// DERRIÈRE les marques sans avoir à arbitrer un `z`, et ne capte aucun événement.
// Rend `null` hors navigateur (jsdom, SSR) : l'option est alors simplement absente.
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
