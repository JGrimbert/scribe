import { describe, expect, it } from 'vitest'
import { applyPageSize, DEFAULT_STYLE_DEFAULTS, normalizeStyleDefaults, styleDefaultsErrors } from './style-defaults'

const DEFAULTS = DEFAULT_STYLE_DEFAULTS

describe('styleDefaultsErrors', () => {
  it('accepte null/absent/vide', () => {
    expect(styleDefaultsErrors(null)).toEqual([])
    expect(styleDefaultsErrors(undefined)).toEqual([])
    expect(styleDefaultsErrors({})).toEqual([])
  })

  it('accepte une césure globale booléenne', () => {
    expect(styleDefaultsErrors({ hyphenation: { global: true } })).toEqual([])
  })

  it('refuse une césure mal typée', () => {
    expect(styleDefaultsErrors({ hyphenation: { global: 'oui' } })[0]).toContain('booléen')
    expect(styleDefaultsErrors({ hyphenation: 'auto' })[0]).toContain('objet')
  })

  it('accepte / refuse un pageSize', () => {
    expect(styleDefaultsErrors({ pageSize: { widthCm: 14.8, heightCm: 21 } })).toEqual([])
    expect(styleDefaultsErrors({ pageSize: { widthCm: -1, heightCm: 21 } })[0]).toContain('widthCm')
    expect(styleDefaultsErrors({ pageSize: { widthCm: 14.8 } })[0]).toContain('heightCm')
  })

  it('accepte des marges miroir (0 permis), refuse le mal formé', () => {
    expect(styleDefaultsErrors({ pageMargins: { topCm: 2, bottomCm: 2, innerCm: 0, outerCm: 3 } })).toEqual([])
    expect(styleDefaultsErrors({ pageMargins: { topCm: -1, bottomCm: 2, innerCm: 1, outerCm: 3 } })[0]).toContain('topCm')
    expect(styleDefaultsErrors({ pageMargins: 'grande' })[0]).toContain('objet')
  })

  it('accepte des runningTitles structurés bien formés (folio = contenu, justification)', () => {
    expect(styleDefaultsErrors({
      runningTitles: {
        header: { enabled: true, recto: 'chapitre', verso: 'titre', heightCm: 1, justification: 'regard' },
        footer: { enabled: true, recto: 'folio', verso: 'folio', heightCm: null, justification: 'centre' },
      },
    })).toEqual([])
  })

  it('refuse un runningTitles structuré mal formé', () => {
    expect(styleDefaultsErrors({ runningTitles: 'oui' })[0]).toContain('objet')
    expect(styleDefaultsErrors({ runningTitles: { header: { recto: 'sous-titre' } } })[0]).toContain('header.recto')
    expect(styleDefaultsErrors({ runningTitles: { footer: { heightCm: -2 } } })[0]).toContain('footer.heightCm')
    expect(styleDefaultsErrors({ runningTitles: { header: { justification: 'ailleurs' } } })[0]).toContain('justification')
  })

  it('accepte la forme héritée plate (migrée à la normalisation)', () => {
    expect(styleDefaultsErrors({ runningTitles: { enabled: true, verso: 'titre', recto: 'chapitre', folio: true } })).toEqual([])
    expect(styleDefaultsErrors({ runningTitles: { verso: 'sous-titre' } })[0]).toContain('verso')
  })
})

describe('normalizeStyleDefaults', () => {
  it('complète les clés absentes par leur défaut', () => {
    expect(normalizeStyleDefaults(null)).toEqual(DEFAULTS)
    expect(normalizeStyleDefaults({})).toEqual(DEFAULTS)
  })

  it('ne retient global=true que sur un vrai booléen true', () => {
    expect(normalizeStyleDefaults({ hyphenation: { global: true } }).hyphenation).toEqual({ global: true })
    expect(normalizeStyleDefaults({ hyphenation: { global: 'true' } }).hyphenation).toEqual({ global: false })
  })

  it('ne retient un pageSize / pageMargins que complets', () => {
    expect(normalizeStyleDefaults({ pageSize: { widthCm: 21, heightCm: 29.7 } }).pageSize).toEqual({ widthCm: 21, heightCm: 29.7 })
    expect(normalizeStyleDefaults({ pageSize: { widthCm: 21 } }).pageSize).toBeNull()
    expect(normalizeStyleDefaults({ pageMargins: { topCm: 2, bottomCm: 2, innerCm: 1.5, outerCm: 2.5 } }).pageMargins)
      .toEqual({ topCm: 2, bottomCm: 2, innerCm: 1.5, outerCm: 2.5 })
    expect(normalizeStyleDefaults({ pageMargins: { topCm: 2, bottomCm: 2, innerCm: 1.5 } }).pageMargins).toBeNull()
  })

  it('complète runningTitles par les défauts métier', () => {
    expect(normalizeStyleDefaults({}).runningTitles).toEqual(DEFAULTS.runningTitles)
  })

  it('normalise une bande : contenu fermé (folio inclus), justification, hauteur', () => {
    const rt = normalizeStyleDefaults({
      runningTitles: { header: { enabled: true, recto: 'bidon', verso: 'chapitre', heightCm: 0.8, justification: 'regard' } },
    }).runningTitles
    expect(rt.header).toEqual({ enabled: true, recto: 'chapitre', verso: 'chapitre', heightCm: 0.8, justification: 'regard' })
    // folio est un contenu valide ; justification inconnue → défaut ; heightCm ≤ 0 → null.
    const f = normalizeStyleDefaults({ runningTitles: { footer: { enabled: true, recto: 'folio', verso: 'folio', heightCm: 0, justification: 'ailleurs' } } }).runningTitles.footer
    expect(f).toEqual({ enabled: true, recto: 'folio', verso: 'folio', heightCm: null, justification: 'centre' })
  })

  it('migre la forme héritée à folio séparé : folio actif → contenu du pied + justification', () => {
    const rt = normalizeStyleDefaults({ runningTitles: { folio: { enabled: true, position: 'regard' } } }).runningTitles
    expect(rt.footer).toMatchObject({ enabled: true, recto: 'folio', verso: 'folio', justification: 'regard' })
  })

  it('migre la forme héritée plate : en-tête = contenu, folio booléen → pied', () => {
    const rt = normalizeStyleDefaults({ runningTitles: { enabled: true, verso: 'titre', recto: 'chapitre', folio: true } }).runningTitles
    expect(rt.header).toMatchObject({ enabled: true, recto: 'chapitre', verso: 'titre' })
    expect(rt.footer).toMatchObject({ enabled: true, recto: 'folio', verso: 'folio' })
  })
})

describe('applyPageSize', () => {
  const odt = { widthCm: 14.8, heightCm: 21, marginTopCm: 1, marginBottomCm: 1.2, marginLeftCm: 2, marginRightCm: 2 }

  it('sans choix utilisateur, rend la page .odt telle quelle (ou null)', () => {
    expect(applyPageSize(odt, null)).toBe(odt)
    expect(applyPageSize(null, null)).toBeNull()
  })

  it('écrase les dimensions mais garde les marges du .odt', () => {
    expect(applyPageSize(odt, { widthCm: 21, heightCm: 29.7 })).toEqual({ ...odt, widthCm: 21, heightCm: 29.7 })
  })

  it('sans relevé .odt, complète avec les marges de secours', () => {
    expect(applyPageSize(null, { widthCm: 10.5, heightCm: 14.8 })).toEqual({
      widthCm: 10.5, heightCm: 14.8, marginTopCm: 2.2, marginBottomCm: 2.2, marginLeftCm: 2, marginRightCm: 2,
    })
  })
})
