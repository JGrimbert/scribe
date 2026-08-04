// Ancres de l'aperçu de FORMAT (écran Maquette) : où tombent, en pixels de la
// scène, les zones que les contrôles dockés désignent — blanc de tête, bande
// d'en-tête, fonds… Pur : reçoit les rects MESURÉS des deux pages (cf. FolioView,
// événement `spread-geometry`) et le gabarit en cm, rend des points et des
// segments à relier (cf. MaquetteFormatCallouts).
//
// Deux traits de l'aperçu, repris TELS QUELS — un trait doit désigner ce qui est
// rendu, pas ce qu'un livre ferait :
//  - la planche est SÉQUENTIELLE : la page 1 (recto, impaire) s'affiche à GAUCHE
//    et le verso à droite, l'inverse d'une vraie planche (cf. `swapParity`,
//    folioStyles.js) ;
//  - les marges ne sont pas re-miroitées pour cet ordre (`buildPageCss` laisse le
//    petit fond à gauche du recto et à droite du verso) : sur la planche affichée
//    les petits fonds tombent donc aux deux bords EXTÉRIEURS.

import { bandHeightCm } from './folioStyles.js'

// Gabarit du pavé gris peint dans une bande (cf. GUIDE_FOLIO_WIDTH /
// GUIDE_TEXT_WIDTH de buildFormatGuidesCss) : un folio est large d'un folio, un
// titre courant d'une ligne courte.
const FOLIO_W_CM = 1.2
const TITLE_W_RATIO = 0.4

const vSpan = (x, y1, y2) => ({ x1: x, y1, x2: x, y2 })
const hSpan = (y, x1, x2) => ({ x1, y1: y, x2, y2: y })

// Une ancre = le point que le trait vient toucher + le segment qu'il souligne
// (l'accolade de cote : hauteur d'un blanc, largeur d'un fond).
const anchorOf = (span) => ({ x: (span.x1 + span.x2) / 2, y: (span.y1 + span.y2) / 2, span })

// `pages` : rects ÉCRAN des pages, dans l'ordre d'affichage (recto puis verso).
// `origin` : rect de la boîte des callouts, pour rendre des coordonnées locales.
export function buildFormatAnchors({ pages, pageSize, margins, runningTitles, origin } = {}) {
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
    const empLeft = left + (parity === 'recto' ? inner : outer)
    const empRight = right - (parity === 'recto' ? outer : inner)
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

  return {
    // Blancs de tête/pied : cotés sur le bord extérieur de la page de droite.
    'blanc-tete': anchorOf(vSpan(verso.right, verso.top, verso.empTop)),
    'blanc-pied': anchorOf(vSpan(verso.right, verso.empBottom, verso.bottom)),
    // Contenus de bande : chacun sur SA page (impaires à gauche, paires à droite).
    'header-recto': blockAnchor(blockOf(rt.header, recto.header, 'recto')),
    'header-verso': blockAnchor(blockOf(rt.header, verso.header, 'verso')),
    'footer-content': blockAnchor(blockOf(rt.footer, verso.footer, 'verso')),
    // Hauteurs : l'accolade cote la bande elle-même.
    'header-height': bandAnchor(verso.header),
    'footer-height': bandAnchor(verso.footer),
    // Fonds : cotés sous la page de droite (petit fond à SA droite, cf. en-tête).
    'petit-fond': anchorOf(hSpan(verso.bottom, verso.empRight, verso.right)),
    'grand-fond': anchorOf(hSpan(verso.bottom, verso.left, verso.empLeft)),
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
    // intérieure (petit) ou extérieure (grand) des DEUX pages — sur la planche
    // séquentielle les petits fonds tombent aux bords extérieurs (cf. en-tête du
    // module) ; bandes = l'emprise de l'en-tête / du pied sur chaque page.
    'zone-blanc-tete': [recto, verso].map((p) => ({ x: p.left, y: p.top, w: p.right - p.left, h: p.empTop - p.top })),
    'zone-blanc-pied': [recto, verso].map((p) => ({ x: p.left, y: p.empBottom, w: p.right - p.left, h: p.bottom - p.empBottom })),
    'zone-petit-fond': [
      { x: recto.left, y: recto.top, w: recto.empLeft - recto.left, h: recto.bottom - recto.top },
      { x: verso.empRight, y: verso.top, w: verso.right - verso.empRight, h: verso.bottom - verso.top },
    ],
    'zone-grand-fond': [
      { x: recto.empRight, y: recto.top, w: recto.right - recto.empRight, h: recto.bottom - recto.top },
      { x: verso.left, y: verso.top, w: verso.empLeft - verso.left, h: verso.bottom - verso.top },
    ],
    'zone-header': [recto.header, verso.header].filter(Boolean),
    'zone-footer': [recto.footer, verso.footer].filter(Boolean),
  }
}
