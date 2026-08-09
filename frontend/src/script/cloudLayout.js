// Placement et couleur du nuage de mots — logique pure. d3-cloud pose dans un repère
// fixe ; useWordCloud anime ensuite les positions.
import cloud from 'd3-cloud'

// Le viewBox du SVG ajoute CLOUD_MARGIN autour pour que les mots ne collent pas aux bords.
export const CLOUD_W = 760
export const CLOUD_H = 440
export const CLOUD_MARGIN = 48

const FONT_MIN = 14
const FONT_RANGE = 40
const BASE_PADDING = 1 // rétréci avec l'échelle (cf. placeWords)

const CHAR_WIDTH_RATIO = 0.5 // largeur moyenne d'un glyphe / taille (Georgia ≈ 0,5)
// Efficacité de remplissage de la spirale. Réglage principal : plus bas = plus d'air,
// ajustement fiable dès le 1er essai ; plus haut = plus dense, risque de réessai.
const FILL = 0.7

function fontSize(count, maxSqrt) {
  return FONT_MIN + (Math.sqrt(count) / maxSqrt) * FONT_RANGE
}

// Échelle globale en forme fermée : somme des aires demandées à l'échelle 1, ramenée
// sous FILL × surface. Aire ∝ échelle² → échelle cible = racine du rapport. Bornée à 1.
export function fitScale(words, { width = CLOUD_W, height = CLOUD_H } = {}) {
  const maxSqrt = Math.sqrt(words[0].count)
  let demand = 0
  for (const w of words) {
    const s = fontSize(w.count, maxSqrt)
    demand += (w.text.length * CHAR_WIDTH_RATIO * s + 2 * BASE_PADDING) * (s + 2 * BASE_PADDING)
  }
  return Math.min(1, Math.sqrt((FILL * width * height) / demand))
}

// PRNG déterministe (mulberry32) : même vocabulaire → mêmes positions.
export function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const RGB_LOW = hexToRgb('#aec4c7')
const RGB_HIGH = hexToRgb('#0e7183')

// Dégradé par fréquence, échelle racine (comme les positions, sinon tout serait clair
// sauf le premier mot).
export function wordColor(count, maxCount) {
  const t = Math.sqrt(count) / Math.sqrt(maxCount)
  const c = RGB_LOW.map((v, i) => Math.round(v + (RGB_HIGH[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

// Place les mots avec d3-cloud. Un seul réessai de sécurité si des mots ont été écartés.
export function placeWords(words, { scale, seed = 1234, width = CLOUD_W, height = CLOUD_H } = {}) {
  return new Promise((resolve) => {
    const run = (s, retry) => {
      const maxSqrt = Math.sqrt(words[0].count)
      cloud()
        .size([width, height])
        .words(
          words.map((w) => ({
            text: w.text,
            count: w.count,
            size: Math.max(6, Math.round(fontSize(w.count, maxSqrt) * s)),
          })),
        )
        .padding(Math.max(1, BASE_PADDING * s))
        .rotate(() => 0)
        .font('Georgia')
        .fontSize((d) => d.size)
        .random(mulberry32(seed))
        .on('end', (out) => {
          if (out.length < words.length && retry) {
            run(s * 0.85, false)
            return
          }
          resolve(out.map((w) => ({ text: w.text, count: w.count, size: w.size, x: w.x, y: w.y })))
        })
        .start()
    }
    run(scale ?? fitScale(words), true)
  })
}
