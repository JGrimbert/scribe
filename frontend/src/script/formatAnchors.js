// Ancres de l'aperçu de FORMAT (écran Maquette) : où tombent, en pixels de la
// scène, les zones que les contrôles dockés désignent — blanc de tête, bande
// d'en-tête, fonds… Pur : reçoit les rects MESURÉS des deux pages (cf. FolioView,
// événement `spread-geometry`) et le gabarit en cm, rend des points et des
// segments à relier (cf. MaquetteFormatCallouts).
//
// Trait de l'aperçu à garder en tête : la planche est SÉQUENTIELLE — la page 1
// (recto, impaire) s'affiche à GAUCHE et le verso à droite, l'inverse d'une vraie
// planche. Le rendu compense en échangeant les marges pour cet ordre
// (`swapParity`, folioStyles.js) : sur la planche affichée le GRAND fond tombe aux
// deux bords extérieurs et le petit de part et d'autre de la gouttière, comme sur
// un livre ouvert. Les zones ci-dessous suivent ce rendu — les deux doivent
// s'accorder, sans quoi un trait désignerait un liséré qui n'est pas le sien.

import { bandHeightCm } from './folioStyles.js'

// Gabarit du pavé gris peint dans une bande (cf. GUIDE_FOLIO_WIDTH /
// GUIDE_TEXT_WIDTH de buildFormatGuidesCss) : un folio est large d'un folio, un
// titre courant d'une ligne courte.
const FOLIO_W_CM = 1.2
const TITLE_W_RATIO = 0.4

// Manchette : blanc qui la sépare de l'empagement (et du bord de feuille quand sa
// largeur est automatique) — le même que celui des titres courants (RUNNING_GAP_CM,
// folioStyles). Les filets gris qui simulent son texte : épaisseur + interligne.
const MANCHETTE_GAP_CM = 0.4
const MANCHETTE_LINES = 4
const MANCHETTE_INK_CM = 0.15
const MANCHETTE_LEAD_CM = 0.38
const MANCHETTE_LAST_RATIO = 0.55 // dernière ligne d'un paragraphe : courte

const vSpan = (x, y1, y2) => ({ x1: x, y1, x2: x, y2 })
const hSpan = (y, x1, x2) => ({ x1, y1: y, x2, y2: y })

// Une ancre = le point que le trait vient toucher + le segment qu'il souligne
// (l'accolade de cote : hauteur d'un blanc, largeur d'un fond).
const anchorOf = (span) => ({ x: (span.x1 + span.x2) / 2, y: (span.y1 + span.y2) / 2, span })

// `pages` : rects ÉCRAN des pages, dans l'ordre d'affichage (recto puis verso).
// `origin` : rect de la boîte des callouts, pour rendre des coordonnées locales.
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
    // Planche séquentielle re-miroitée par le rendu : le recto est affiché à
    // GAUCHE, son grand fond est donc à sa gauche (et l'inverse au verso).
    const empLeft = left + (parity === 'recto' ? outer : inner)
    const empRight = right - (parity === 'recto' ? inner : outer)
    const empTop = top + (m.topCm ?? 0) * k
    const empBottom = bottom - (m.bottomCm ?? 0) * k
    // Une bande occupe le sommet (en-tête) ou le bas (pied) de l'empagement.
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

  // Le pavé gris DANS la bande : `regard` le pousse au bord extérieur de la
  // planche affichée (gauche au recto, droite au verso, cf. buildFormatGuidesCss).
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
  // Un contenu de bande s'accroche par le bord droit de son pavé : le trait part
  // vers la droite, où sont les cartes.
  const blockAnchor = (blk) => (blk ? anchorOf(vSpan(blk.x + blk.w, blk.y, blk.y + blk.h)) : null)
  const bandAnchor = (box) => (box ? anchorOf(vSpan(box.x + box.w, box.y, box.y + box.h)) : null)

  // Colonne de manchette : dans le GRAND fond, collée au bord de l'empagement dont
  // un blanc la sépare. Largeur libre (`widthCm`) ou, à défaut, le grand fond moins
  // ses deux blancs. Hauteur = celle du CORPS (sous l'en-tête, au-dessus du pied) :
  // une note en marge se lit en regard du texte, pas des titres courants.
  const gap = MANCHETTE_GAP_CM * k
  const manchetteColumn = (p) => {
    const strip = p.parity === 'recto' ? p.empLeft - p.left : p.right - p.empRight
    const w = manchette?.widthCm ? Math.min(manchette.widthCm * k, strip - gap) : strip - 2 * gap
    if (!(w > 0)) return null
    const x = p.parity === 'recto' ? p.empLeft - gap - w : p.empRight + gap
    const top = p.header ? p.header.y + p.header.h + gap : p.empTop
    const bottom = p.footer ? p.footer.y - gap : p.empBottom
    return bottom > top ? { x, y: top, w, h: bottom - top } : null
  }

  // Les filets gris qui simulent son texte, rendus tels quels par l'overlay : des
  // lignes pleines, la dernière courte (fin de paragraphe). Rognés à la hauteur
  // disponible plutôt que débordés sur le pied.
  const manchetteLines = (col) => {
    if (!col) return []
    const ink = MANCHETTE_INK_CM * k
    const lead = MANCHETTE_LEAD_CM * k
    const out = []
    for (let i = 0; i < MANCHETTE_LINES; i += 1) {
      const y = col.y + i * lead
      if (y + ink > col.y + col.h) break
      const last = i === MANCHETTE_LINES - 1
      out.push({ x: col.x, y, w: last ? col.w * MANCHETTE_LAST_RATIO : col.w, h: ink })
    }
    return out
  }

  const manchetteCols = [recto, verso].map(manchetteColumn).filter(Boolean)

  return {
    // Blancs de tête/pied : cotés sur le bord extérieur de la page de GAUCHE (recto
    // affiché à gauche) — leurs cartes vivent désormais dans la colonne de gauche.
    'blanc-tete': anchorOf(vSpan(recto.left, recto.top, recto.empTop)),
    'blanc-pied': anchorOf(vSpan(recto.left, recto.empBottom, recto.bottom)),
    // Contenus de bande : chacun sur SA page (impaires à gauche, paires à droite).
    'header-recto': blockAnchor(blockOf(rt.header, recto.header, 'recto')),
    'header-verso': blockAnchor(blockOf(rt.header, verso.header, 'verso')),
    'footer-content': blockAnchor(blockOf(rt.footer, verso.footer, 'verso')),
    // Hauteurs : l'accolade cote la bande elle-même.
    'header-height': bandAnchor(verso.header),
    'footer-height': bandAnchor(verso.footer),
    // Fonds : cotés sous la page de droite (petit fond à SA gauche, côté gouttière).
    'petit-fond': anchorOf(hSpan(verso.bottom, verso.left, verso.empLeft)),
    'grand-fond': anchorOf(hSpan(verso.bottom, verso.empRight, verso.right)),
    // Boîtes des bandes ({ x, y, w, h } | null) : les selects de contenu (titre
    // courant / folio) se posent DESSUS, à même la zone grisée (pas de trait).
    'header-recto-box': recto.header,
    'header-verso-box': verso.header,
    'footer-recto-box': recto.footer,
    'footer-verso-box': verso.footer,
    // Zones SURLIGNABLES : une LISTE de rects ({ x, y, w, h }), un PAR PAGE — la
    // surface qu'un contrôle désigne ne s'étend jamais d'une page à l'autre (un
    // rectangle unique enjamberait la gouttière, où il n'y a pas de papier).
    // Blancs = la bande de marge de chaque page ; fonds = le liséré de marge
    // intérieure (petit, côté gouttière) ou extérieure (grand, aux deux bords de la
    // planche) des DEUX pages ; bandes = l'emprise de l'en-tête / du pied sur
    // chaque page ; manchette = sa colonne, dans le grand fond.
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
    // Filets gris de la manchette, à plat (les deux pages mêlées) : l'overlay les
    // peint tels quels, il n'a rien à recalculer.
    'manchette-lines': manchetteCols.flatMap(manchetteLines),
  }
}
