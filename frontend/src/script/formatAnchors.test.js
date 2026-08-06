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
    // Bord extérieur de la page de GAUCHE (recto affiché à gauche) : x = recto.left.
    const a = build()['blanc-tete']
    expect(a.span).toEqual({ x1: 0, y1: 0, x2: 0, y2: 20 })
    expect(a).toMatchObject({ x: 0, y: 10 })
  })

  it('cote le blanc de pied sous l\'empagement', () => {
    expect(build()['blanc-pied'].span).toEqual({ x1: 0, y1: 180, x2: 0, y2: 210 })
  })

  it('place les fonds sous la page de droite, petit fond côté gouttière', () => {
    // Verso affiché à DROITE, marges re-miroitées par le rendu : petit fond (1,5 cm)
    // à sa gauche, grand fond (2,5 cm) à sa droite.
    expect(build()['petit-fond'].span).toEqual({ x1: 168, y1: 210, x2: 183, y2: 210 })
    expect(build()['grand-fond'].span).toEqual({ x1: 291, y1: 210, x2: 316, y2: 210 })
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
    // Bande = [empTop, empTop + hauteur] au bord droit de l'empagement du verso
    // (grand fond, 2,5 cm, à sa droite).
    expect(a['header-height'].span).toEqual({ x1: 291, y1: 20, x2: 291, y2: 30 })
  })

  it('suit le pavé gris : centré vs en regard, et la largeur du folio', () => {
    const centre = { header: { enabled: true, recto: 'titre', verso: 'titre', heightCm: 1, justification: 'centre' } }
    // Empagement du recto : [25, 133] → pavé de 40 % (43,2 px) centré → bord droit à 100,6.
    expect(build({ runningTitles: centre })['header-recto'].x).toBeCloseTo(100.6, 5)

    const regard = { header: { ...centre.header, justification: 'regard' } }
    // En regard, le recto (affiché à gauche) porte son pavé au bord GAUCHE.
    expect(build({ runningTitles: regard })['header-recto'].x).toBeCloseTo(68.2, 5)

    const folio = { footer: { enabled: true, recto: 'folio', verso: 'folio', heightCm: 1, justification: 'regard' } }
    const a = build({ runningTitles: folio })
    // Verso en regard : pavé de 1,2 cm collé au bord droit de son empagement.
    expect(a['footer-content'].x).toBeCloseTo(291, 5)
  })

  it('rend une zone surlignable PAR PAGE, jamais un rect enjambant la gouttière', () => {
    const a = build()
    // Blanc de tête : la bande de marge de chaque page, pas un bandeau continu.
    expect(a['zone-blanc-tete']).toEqual([
      { x: 0, y: 0, w: 148, h: 20 },
      { x: 168, y: 0, w: 148, h: 20 },
    ])
    expect(a['zone-blanc-pied']).toEqual([
      { x: 0, y: 180, w: 148, h: 30 },
      { x: 168, y: 180, w: 148, h: 30 },
    ])
  })

  it('coche les DEUX colonnes d\'un fond, aux bords extérieurs pour le grand', () => {
    const a = build()
    // Marges re-miroitées pour la planche séquentielle : petit fond (1,5 cm) de part
    // et d'autre de la gouttière.
    expect(a['zone-petit-fond']).toEqual([
      { x: 133, y: 0, w: 15, h: 210 },
      { x: 168, y: 0, w: 15, h: 210 },
    ])
    // Grand fond (2,5 cm) : aux deux bords extérieurs de la planche.
    expect(a['zone-grand-fond']).toEqual([
      { x: 0, y: 0, w: 25, h: 210 },
      { x: 291, y: 0, w: 25, h: 210 },
    ])
  })

  it('pose la manchette dans le grand fond, largeur auto = fond moins ses blancs', () => {
    const a = build()
    // Grand fond de 25 px moins 2 blancs de 4 px → 17 px, collée à l'empagement
    // (recto : bord gauche de l'empagement à 25, donc x = 25 − 4 − 17 = 4).
    expect(a['zone-manchette']).toEqual([
      { x: 4, y: 20, w: 17, h: 160 },
      { x: 295, y: 20, w: 17, h: 160 },
    ])
    // Largeur imposée : collée au même bord, le reste tombe côté bord de feuille.
    expect(build({ manchette: { enabled: true, widthCm: 1 } })['zone-manchette'][0])
      .toEqual({ x: 11, y: 20, w: 10, h: 160 })
  })

  it('descend la manchette sous l\'en-tête et rend ses filets, le dernier court', () => {
    const rt = { header: { enabled: true, recto: 'titre', verso: 'titre', heightCm: 1, justification: 'centre' } }
    const a = build({ runningTitles: rt })
    // Corps = sous la bande (20 → 30) plus son blanc de 4 px.
    expect(a['zone-manchette'][0]).toMatchObject({ y: 34, h: 146 })
    const lines = a['manchette-lines']
    expect(lines).toHaveLength(8) // 4 filets par page
    expect(lines[0]).toEqual({ x: 4, y: 34, w: 17, h: 1.5 })
    expect(lines[3]).toMatchObject({ y: 45.4 })
    expect(lines[3].w).toBeCloseTo(9.35, 5)
  })

  it('zone de bande : une par page, vide tant que la bande dort', () => {
    expect(build()['zone-header']).toEqual([])
    const rt = { header: { enabled: true, recto: 'titre', verso: 'titre', heightCm: 1, justification: 'centre' } }
    const zone = build({ runningTitles: rt })['zone-header']
    expect(zone).toHaveLength(2)
    expect(zone[0]).toEqual({ x: 25, y: 20, w: 108, h: 10 })
  })

  it('décale toutes les ancres de l\'origine de la boîte', () => {
    const a = build({ origin: { left: 40, top: 12 } })
    expect(a['blanc-tete'].span).toEqual({ x1: -40, y1: -12, x2: -40, y2: 8 })
  })
})
