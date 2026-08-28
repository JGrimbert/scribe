import { describe, it, expect } from 'vitest'
import { chapitrageTornPages, liminaireTornPages } from './tornFragments'

const countEll = (s) => (s.match(/frag-ell/g) ?? []).length

describe('chapitrageTornPages', () => {
  // Niveau 0 : deux chapitres. Le 1er porte titre/def/corps ; le 2e ajoute un style hors
  // modèle (Exergue) qui n'existe pas dans le 1er.
  const axes = [{ id: 'n1', children: [] }, { id: 'n2', children: [] }]
  const data = {
    n1: { titre: 'Le blaireau', styleName: 'Titre', texte: [
      { type: 'paragraph', styleName: 'Definition', text: 'Mammifère.' },
      { type: 'paragraph', styleName: 'Corps', text: 'Un.' },
      { type: 'paragraph', styleName: 'Corps', text: 'Deux.' },
    ] },
    n2: { titre: 'Le renard', styleName: 'Titre', texte: [
      { type: 'paragraph', styleName: 'Corps', text: 'Roux.' },
      { type: 'paragraph', styleName: 'Exergue', text: 'Hors modèle.' },
    ] },
  }
  const margins = { topCm: 2, bottomCm: 2, innerCm: 1.5, outerCm: 2.5 }

  it('page 1 = tête (titre→1er corps) du 1er chapitre, page 2 = extras', () => {
    const pages = chapitrageTornPages(axes, data, 0, margins)
    expect(pages.length).toBe(2)
    const head = pages[0].entries[0].text
    expect(head).toContain('Le blaireau')
    expect(head).toContain('data-style="Titre"')
    expect(head).toContain('data-style="Definition"')
    expect(head).toContain('data-style="Corps"')
    expect(countEll(head)).toBe(1)
  })

  it('collecte les styles hors modèle des AUTRES chapitres du niveau', () => {
    const extras = chapitrageTornPages(axes, data, 0, margins)[1].entries
    // Exergue n'existe que dans le 2e chapitre → doit apparaître en lambeau.
    const joined = extras.map((e) => e.text).join('')
    expect(joined).toContain('data-style="Exergue"')
    expect(joined).toContain('Hors modèle.')
    expect(countEll(extras[0].text)).toBe(2)
  })

  it('les feuilles portent les marges du livre en padding', () => {
    const head = chapitrageTornPages(axes, data, 0, margins)[0].entries[0].text
    expect(head).toMatch(/padding:2cm 2\.5cm 0\.4cm 1\.5cm/)
  })

  it('type html (passe-plat) pour l\'imposition', () => {
    expect(chapitrageTornPages(axes, data, 0, margins).every((p) => p.entries.every((e) => e.type === 'html'))).toBe(true)
  })

  it('tolère une entrée vide', () => {
    expect(chapitrageTornPages(null, null, null)).toEqual([])
    expect(chapitrageTornPages([], {}, 0)).toEqual([])
  })
})

describe('liminaireTornPages', () => {
  it('aplati les entrées non blanches des planches (sans titre de section)', () => {
    const spreads = [
      { left: { page: { entries: [{ type: 'paragraph', styleName: 'Faux-titre', text: 'Titre' }] } },
        right: { page: { entries: [{ isBlank: true }, { type: 'paragraph', styleName: 'Dedicace', text: 'À toi' }] } } },
      { left: { blank: true }, right: { cover: true } },
    ]
    const head = liminaireTornPages(spreads, { topCm: 2, outerCm: 2, bottomCm: 2, innerCm: 2 })[0].entries[0].text
    expect(head).toContain('data-style="Faux-titre"')
    expect(head).not.toContain('<h1></h1>')
  })

  it('tolère une entrée vide', () => {
    expect(liminaireTornPages(null)).toEqual([])
  })
})
