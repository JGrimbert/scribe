import { describe, expect, it } from 'vitest'
import {
  PAGE_FORMATS, effectiveMargins, effectivePage, hasRunningZones, marginsFromOdt, matchFormat, runningTitlesFromOdt,
} from './pageFormats'

describe('matchFormat', () => {
  it('reconnaît un format à ±0,3 cm (le témoin A5 est à 14,801 × 21,001)', () => {
    expect(matchFormat(14.801, 21.001)?.key).toBe('A5')
    expect(matchFormat(21, 29.7)?.key).toBe('A4')
  })

  it('rend null hors tolérance ou sans mesures', () => {
    expect(matchFormat(12, 19)).toBeNull()
    expect(matchFormat(null, 21)).toBeNull()
  })

  it('chaque format du select est reconnu par ses propres dimensions', () => {
    for (const f of PAGE_FORMATS) {
      expect(matchFormat(f.widthCm, f.heightCm)?.key).toBe(f.key)
    }
  })
})

describe('effectivePage', () => {
  const odt = { widthCm: 14.8, heightCm: 21, marginTopCm: 1, marginBottomCm: 1.2, marginLeftCm: 2, marginRightCm: 2 }

  it('sans choix utilisateur, rend la page .odt telle quelle (ou null)', () => {
    expect(effectivePage(odt, null)).toBe(odt)
    expect(effectivePage(null, null)).toBeNull()
  })

  it('écrase les dimensions mais garde les marges du .odt', () => {
    expect(effectivePage(odt, { widthCm: 21, heightCm: 29.7 })).toEqual({ ...odt, widthCm: 21, heightCm: 29.7 })
  })

  it('sans relevé .odt, complète avec les marges de secours', () => {
    expect(effectivePage(null, { widthCm: 10.5, heightCm: 14.8 })).toEqual({
      widthCm: 10.5, heightCm: 14.8,
      marginTopCm: 2.2, marginBottomCm: 2.2, marginLeftCm: 2, marginRightCm: 2,
    })
  })
})

describe('marges', () => {
  const odt = { widthCm: 14.8, heightCm: 21, marginTopCm: 1, marginBottomCm: 1.2, marginLeftCm: 1.5, marginRightCm: 2.5 }

  it('marginsFromOdt : petit fond ← gauche, grand fond ← droite', () => {
    expect(marginsFromOdt(odt)).toEqual({ topCm: 1, bottomCm: 1.2, innerCm: 1.5, outerCm: 2.5 })
  })

  it('marginsFromOdt : fallback A5 sans relevé', () => {
    expect(marginsFromOdt(null)).toEqual({ topCm: 2.2, bottomCm: 2.2, innerCm: 2, outerCm: 2 })
  })

  it('effectiveMargins : surcharge utilisateur si présente, sinon .odt', () => {
    const override = { topCm: 3, bottomCm: 3, innerCm: 1, outerCm: 4 }
    expect(effectiveMargins(odt, override)).toBe(override)
    expect(effectiveMargins(odt, null)).toEqual({ topCm: 1, bottomCm: 1.2, innerCm: 1.5, outerCm: 2.5 })
  })
})

describe('runningTitlesFromOdt', () => {
  it('rend null si le .odt ne déclare aucune zone', () => {
    expect(runningTitlesFromOdt(null)).toBeNull()
    expect(runningTitlesFromOdt({ widthCm: 14.8, heightCm: 21 })).toBeNull()
    expect(hasRunningZones({ widthCm: 14.8, heightCm: 21 })).toBe(false)
  })

  it('mappe l’en-tête verso (header-left)/recto (header) + hauteur ; page-number → contenu folio du pied', () => {
    const page = {
      headerLeft: { text: 'Mon Livre', fields: ['title'], heightCm: 0.8 },
      header: { text: '', fields: ['chapter'] },
      footer: { text: '', fields: ['page-number'] },
    }
    const rt = runningTitlesFromOdt(page)
    expect(rt.header).toEqual({ enabled: true, recto: 'chapitre', verso: 'titre', heightCm: 0.8, justification: 'centre' })
    expect(rt.footer).toMatchObject({ enabled: true, recto: 'folio', verso: 'folio' })
  })

  it('sans variante gauche, l’en-tête unique vaut pour les deux côtés ; texte libre → titre', () => {
    const rt = runningTitlesFromOdt({ header: { text: 'Statique', fields: [] } })
    expect(rt.header).toMatchObject({ enabled: true, recto: 'titre', verso: 'titre' })
    expect(rt.footer.enabled).toBe(false)
  })

  it('un page-number en en-tête → contenu folio de l’en-tête', () => {
    const rt = runningTitlesFromOdt({ header: { text: '', fields: ['page-number'] } })
    expect(rt.header).toMatchObject({ enabled: true, recto: 'folio', verso: 'folio' })
  })
})
