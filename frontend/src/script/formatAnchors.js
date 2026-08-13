// Ancres de l'aperçu de FORMAT : où tombent, en pixels de la scène, les zones que les
// contrôles dockés désignent. Pur : reçoit les rects mesurés des deux pages et le
// gabarit en cm, rend points/segments (cf. MaquetteFormatCallouts).
//
// GOTCHA : la planche est séquentielle — le recto (impair) s'affiche à GAUCHE, le verso
// à droite (l'inverse d'une vraie planche). Le rendu compense en échangeant les marges
// (swapParity, folioStyles) ; les zones ci-dessous suivent ce rendu.

import { bandHeightCm } from './folioStyles.js'

// Pavé gris peint dans une bande : un folio large d'un folio, un titre courant court.
const FOLIO_W_CM = 1.2
const TITLE_W_RATIO = 0.4

const MANCHETTE_GAP_CM = 0.4
const MANCHETTE_LINES = 4
const MANCHETTE_INK_CM = 0.15
const MANCHETTE_LEAD_CM = 0.38
const MANCHETTE_LAST_RATIO = 0.55 // dernière ligne d'un paragraphe : courte

const vSpan = (x, y1, y2) => ({ x1: x, y1, x2: x, y2 })
const hSpan = (y, x1, x2) => ({ x1, y1: y, x2, y2: y })

// Une ancre = le point que le trait touche + le segment qu'il souligne.
const anchorOf = (span) => ({ x: (span.x1 + span.x2) / 2, y: (span.y1 + span.y2) / 2, span })

// `pages` : rects écran, ordre d'affichage (recto puis verso). `origin` : boîte des
// callouts, pour des coordonnées locales.
export function buildFormatAnchors({ pages, pageSize, margins, runningTitles, manchette, origin } = {}) {
  if (!pages || pages.length < 2 || !pageSize?.heightCm) return {}
  const ox = origin?.left ?? 0
  const oy = origin?.top ?? 0
  const k = pages[0].height / pageSize.heightCm // px par cm
  if (!(k > 0)) return {}
  const m = margins ?? { topCm: 0, bottomCm: 0, innerCm: 0, outerCm: 0 }
  const rt = runningTitles ?? {}

  const pageGeom = (rect, parity) => {
    const left = rect.left - ox
    const top = rect.top - oy
    const right = left + rect.width
    const bottom = top + rect.height
    const inner = (m.innerCm ?? 0) * k
    const outer = (m.outerCm ?? 0) * k
    // Recto affiché à gauche → son grand fond est à sa gauche (inverse au verso).
    const empLeft = left + (parity === 'recto' ? outer : inner)
    const empRight = right - (parity === 'recto' ? inner : outer)
    const empTop = top + (m.topCm ?? 0) * k
    const empBottom = bottom - (m.bottomCm ?? 0) * k
    const bandBox = (band, edge) => {
      if (!band?.enabled) return null
      const h = bandHeightCm(band) * k
      return { x: empLeft, w: empRight - empLeft, h, y: edge === 'top' ? empTop : empBottom - h }
    }
    return {
      left, top, right, bottom, empLeft, empRight, empTop, empBottom, parity,
      header: bandBox(rt.header, 'top'),
      footer: bandBox(rt.footer, 'bottom'),
    }
  }

  const recto = pageGeom(pages[0], 'recto')
  const verso = pageGeom(pages[1], 'verso')

  // `regard` pousse le pavé au bord extérieur de la planche affichée.
  const blockOf = (band, box, parity) => {
    if (!band || !box) return null
    const content = parity === 'recto' ? band.recto : band.verso
    if (!content || content === 'aucun') return null
    const w = content === 'folio' ? FOLIO_W_CM * k : box.w * TITLE_W_RATIO
    const x = band.justification === 'regard'
      ? (parity === 'recto' ? box.x : box.x + box.w - w)
      : box.x + box.w / 2 - w / 2
    return { x, y: box.y, w, h: box.h }
  }
  const blockAnchor = (blk) => (blk ? anchorOf(vSpan(blk.x + blk.w, blk.y, blk.y + blk.h)) : null)
  const bandAnchor = (box) => (box ? anchorOf(vSpan(box.x + box.w, box.y, box.y + box.h)) : null)

  // Note de manchette : un petit BLOC de quelques lignes dans le grand fond, CENTRÉ
  // verticalement dans le corps (pas ferré en tête) — une note en marge se lit en
  // regard du texte, pas des titres courants. Toujours calculée (rendue en permanence
  // côté hôte), largeur bornée par la manchette réglée ou la marge disponible.
  const gap = MANCHETTE_GAP_CM * k
  const manchetteNote = (p) => {
    const strip = p.parity === 'recto' ? p.empLeft - p.left : p.right - p.empRight
    const w = manchette?.widthCm ? Math.min(manchette.widthCm * k, strip - gap) : strip - 2 * gap
    if (!(w > 0)) return null
    const x = p.parity === 'recto' ? p.empLeft - gap - w : p.empRight + gap
    const bodyTop = p.header ? p.header.y + p.header.h + gap : p.empTop
    const bodyBottom = p.footer ? p.footer.y - gap : p.empBottom
    const ink = MANCHETTE_INK_CM * k
    const lead = MANCHETTE_LEAD_CM * k
    const h = (MANCHETTE_LINES - 1) * lead + ink
    if (!(bodyBottom - bodyTop >= h)) return null
    return { x, y: bodyTop + (bodyBottom - bodyTop - h) / 2, w, h }
  }

  const manchetteLines = (note) => {
    if (!note) return []
    const ink = MANCHETTE_INK_CM * k
    const lead = MANCHETTE_LEAD_CM * k
    const out = []
    for (let i = 0; i < MANCHETTE_LINES; i += 1) {
      const y = note.y + i * lead
      if (y + ink > note.y + note.h + 0.5) break
      const last = i === MANCHETTE_LINES - 1
      out.push({ x: note.x, y, w: last ? note.w * MANCHETTE_LAST_RATIO : note.w, h: ink })
    }
    return out
  }

  const manchetteCols = [recto, verso].map(manchetteNote).filter(Boolean)

  // Cote des blancs de tête/pied posée au MILIEU de la marge extérieure (grand fond),
  // pas sur le bord de page : la pointe de la fuyante entre dans le blanc disponible.
  const blancX = (recto.left + recto.empLeft) / 2
  return {
    'blanc-tete': anchorOf(vSpan(blancX, recto.top, recto.empTop)),
    'blanc-pied': anchorOf(vSpan(blancX, recto.empBottom, recto.bottom)),
    'header-recto': blockAnchor(blockOf(rt.header, recto.header, 'recto')),
    'header-verso': blockAnchor(blockOf(rt.header, verso.header, 'verso')),
    'footer-content': blockAnchor(blockOf(rt.footer, verso.footer, 'verso')),
    'header-height': bandAnchor(verso.header),
    'footer-height': bandAnchor(verso.footer),
    'petit-fond': anchorOf(hSpan(verso.bottom, verso.left, verso.empLeft)),
    'grand-fond': anchorOf(hSpan(verso.bottom, verso.empRight, verso.right)),
    // Boîtes des bandes : les selects de contenu se posent DESSUS (pas de trait).
    'header-recto-box': recto.header,
    'header-verso-box': verso.header,
    'footer-recto-box': recto.footer,
    'footer-verso-box': verso.footer,
    // Zones surlignables : une liste de rects, un PAR PAGE (un rect unique enjamberait
    // la gouttière, où il n'y a pas de papier).
    'zone-blanc-tete': [recto, verso].map((p) => ({ x: p.left, y: p.top, w: p.right - p.left, h: p.empTop - p.top })),
    'zone-blanc-pied': [recto, verso].map((p) => ({ x: p.left, y: p.empBottom, w: p.right - p.left, h: p.bottom - p.empBottom })),
    'zone-petit-fond': [
      { x: recto.empRight, y: recto.top, w: recto.right - recto.empRight, h: recto.bottom - recto.top },
      { x: verso.left, y: verso.top, w: verso.empLeft - verso.left, h: verso.bottom - verso.top },
    ],
    'zone-grand-fond': [
      { x: recto.left, y: recto.top, w: recto.empLeft - recto.left, h: recto.bottom - recto.top },
      { x: verso.empRight, y: verso.top, w: verso.right - verso.empRight, h: verso.bottom - verso.top },
    ],
    'zone-header': [recto.header, verso.header].filter(Boolean),
    'zone-footer': [recto.footer, verso.footer].filter(Boolean),
    'zone-manchette': manchetteCols,
    'manchette-lines': manchetteCols.flatMap(manchetteLines),
  }
}
