import { describe, it, expect } from 'vitest'
import { buildFormatAnchors } from './formatAnchors.js'

// Planche témoin : deux pages A5 (14,8 × 21 cm) rendues à 10 px/cm, côte à côte
// avec 20 px de gouttière, la boîte des callouts à l'origine (0, 0).
const PAGE_SIZE = { widthCm: 14.8, heightCm: 21 }
const MARGINS = { topCm: 2, bottomCm: 3, innerCm: 1.5, outerCm: 2.5 }
const PAGES = [
  { left: 0, top: 0, width: 148, height: 210 },
  { left: 168, top: 0, width: 148, height: 210 },
]
const build = (over = {}) => buildFormatAnchors({
  pages: PAGES, pageSize: PAGE_SIZE, margins: MARGINS, ...over,
})

describe('buildFormatAnchors', () => {
  it('rend vide sans les deux pages ou sans gabarit', () => {
    expect(buildFormatAnchors()).toEqual({})
    expect(build({ pages: [PAGES[0]] })).toEqual({})
    expect(build({ pageSize: null })).toEqual({})
  })

  it('cote le blanc de tête du bord de feuille au bord de l\'empagement', () => {
    const a = build()['blanc-tete']
    expect(a.span).toEqual({ x1: 316, y1: 0, x2: 316, y2: 20 })
    expect(a).toMatchObject({ x: 316, y: 10 })
  })

  it('cote le blanc de pied sous l\'empagement', () => {
    expect(build()['blanc-pied'].span).toEqual({ x1: 316, y1: 180, x2: 316, y2: 210 })
  })

  it('place les fonds sous la page de droite, petit fond côté extérieur', () => {
    // Verso affiché à DROITE : petit fond à sa droite, grand fond à sa gauche
    // (la planche est séquentielle, cf. l'en-tête du module).
    expect(build()['petit-fond'].span).toEqual({ x1: 301, y1: 210, x2: 316, y2: 210 })
    expect(build()['grand-fond'].span).toEqual({ x1: 168, y1: 210, x2: 193, y2: 210 })
  })

  it('ignore les bandes tant qu\'elles ne sont pas activées', () => {
    const a = build({ runningTitles: { header: { enabled: false }, footer: { enabled: false } } })
    expect(a['header-recto']).toBeNull()
    expect(a['header-height']).toBeNull()
    expect(a['footer-content']).toBeNull()
  })

  it('cote la bande d\'en-tête au sommet de l\'empagement, à sa hauteur', () => {
    const rt = { header: { enabled: true, recto: 'titre', verso: 'titre', heightCm: 1, justification: 'centre' } }
    const a = build({ runningTitles: rt })
    // Bande = [empTop, empTop + hauteur] au bord droit de l'empagement du verso.
    expect(a['header-height'].span).toEqual({ x1: 301, y1: 20, x2: 301, y2: 30 })
  })

  it('suit le pavé gris : centré vs en regard, et la largeur du folio', () => {
    const centre = { header: { enabled: true, recto: 'titre', verso: 'titre', heightCm: 1, justification: 'centre' } }
    // Empagement du recto : [15, 123] → pavé de 40 % (43,2 px) centré → bord droit à 90,6.
    expect(build({ runningTitles: centre })['header-recto'].x).toBeCloseTo(90.6, 5)

    const regard = { header: { ...centre.header, justification: 'regard' } }
    // En regard, le recto (affiché à gauche) porte son pavé au bord GAUCHE.
    expect(build({ runningTitles: regard })['header-recto'].x).toBeCloseTo(58.2, 5)

    const folio = { footer: { enabled: true, recto: 'folio', verso: 'folio', heightCm: 1, justification: 'regard' } }
    const a = build({ runningTitles: folio })
    // Verso en regard : pavé de 1,2 cm collé au bord droit de son empagement.
    expect(a['footer-content'].x).toBeCloseTo(301, 5)
  })

  it('décale toutes les ancres de l\'origine de la boîte', () => {
    const a = build({ origin: { left: 40, top: 12 } })
    expect(a['blanc-tete'].span).toEqual({ x1: 276, y1: -12, x2: 276, y2: 8 })
  })
})
