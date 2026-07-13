// Placement et couleur du nuage de mots — logique pure (aucun état Vue).
// Le nuage est posé par d3-cloud dans un repère fixe (CLOUD_W × CLOUD_H) ; la
// couche Vue (useWordCloud) anime ensuite les positions.
import cloud from 'd3-cloud'

// Repère de placement. Le viewBox du SVG ajoute CLOUD_MARGIN autour pour que
// les mots ne collent pas aux bords (le nuage respire).
export const CLOUD_W = 760
export const CLOUD_H = 440
export const CLOUD_MARGIN = 48

// Police : plancher + amplitude (racine de la fréquence, comme les positions).
const FONT_MIN = 14
const FONT_RANGE = 40
// Espacement de base entre mots (px), rétréci avec l'échelle (cf. placeWords) —
// sinon l'écart paraît énorme quand la police est petite.
const BASE_PADDING = 4

// ── Heuristique d'échelle (évite de rejouer d3-cloud pour « tâtonner ») ──
// Largeur moyenne d'un glyphe rapportée à la taille de police (Georgia ≈ 0,5).
const CHAR_WIDTH_RATIO = 0.5
// Efficacité de remplissage empirique de la spirale archimédienne. Réglage
// principal du nuage : plus bas = police plus petite, plus d'air, ajustement
// fiable dès le premier essai ; plus haut = plus dense, risque de réessai.
const FILL = 0.55

function fontSize(count, maxSqrt) {
  return FONT_MIN + (Math.sqrt(count) / maxSqrt) * FONT_RANGE
}

// Échelle globale de police, en forme fermée : on somme l'aire (largeur×hauteur,
// padding compris) demandée par tous les mots à l'échelle 1, et on la ramène
// sous FILL × surface disponible. Comme aire ∝ échelle², l'échelle cible est la
// racine du rapport. Bornée à 1 (on ne grossit jamais au-delà de la base).
export function fitScale(words) {
  const maxSqrt = Math.sqrt(words[0].count)
  let demand = 0
  for (const w of words) {
    const s = fontSize(w.count, maxSqrt)
    demand += (w.lemma.length * CHAR_WIDTH_RATIO * s + 2 * BASE_PADDING) * (s + 2 * BASE_PADDING)
  }
  return Math.min(1, Math.sqrt((FILL * CLOUD_W * CLOUD_H) / demand))
}

// PRNG déterministe (mulberry32) : même vocabulaire → mêmes positions maison.
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

// Dégradé par fréquence : mot rare (clair) → mot fréquent (teal profond).
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const RGB_LOW = hexToRgb('#aec4c7')
const RGB_HIGH = hexToRgb('#0e7183')

// Échelle en racine carrée (comme les positions) : sinon tout serait clair sauf
// le premier mot. Appelée une seule fois par layout (résultat mémoïsé côté Vue).
export function wordColor(count, maxCount) {
  const t = Math.sqrt(count) / Math.sqrt(maxCount)
  const c = RGB_LOW.map((v, i) => Math.round(v + (RGB_HIGH[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

// Place les mots avec d3-cloud à l'échelle donnée et résout avec les positions
// (champs minimaux relus par la couche Vue). Padding proportionnel à l'échelle.
// Un seul réessai de sécurité si des mots ont été écartés (l'heuristique vise
// assez bas pour que ce soit rare).
export function placeWords(words, { scale, seed = 1234 } = {}) {
  return new Promise((resolve) => {
    const run = (s, retry) => {
      const maxSqrt = Math.sqrt(words[0].count)
      cloud()
        .size([CLOUD_W, CLOUD_H])
        .words(
          words.map((w) => ({
            text: w.lemma,
            count: w.count,
            size: Math.max(6, Math.round(fontSize(w.count, maxSqrt) * s)),
          })),
        )
        .spiral('archimedean')
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
