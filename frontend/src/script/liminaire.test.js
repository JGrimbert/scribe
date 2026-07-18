import { describe, it, expect } from 'vitest'
import { LIMINAIRE_PAGES, groupLiminairePages, entryPlainText, sideOfPageStart, pageKey, deriveEligibility } from './liminaire'

const P = (text, pageStart) => ({ type: 'paragraph', text, ...(pageStart ? { pageStart } : {}) })

describe('LIMINAIRE_PAGES', () => {
  it('a 16 types, seuls faux-titre/page-de-titre/mentions-légales obligatoires', () => {
    expect(LIMINAIRE_PAGES).toHaveLength(16)
    const obl = LIMINAIRE_PAGES.filter((p) => p.obligatoire).map((p) => p.key)
    expect(obl).toEqual(['faux-titre', 'page-de-titre', 'mentions-legales'])
  })
})

describe('sideOfPageStart', () => {
  it('recto/verso portés, simple saut et rien → auto', () => {
    expect(sideOfPageStart('recto')).toBe('recto')
    expect(sideOfPageStart('verso')).toBe('verso')
    expect(sideOfPageStart('page')).toBe('auto')
    expect(sideOfPageStart(null)).toBe('auto')
  })
})

describe('entryPlainText', () => {
  it('retire les marqueurs et normalise les espaces', () => {
    expect(entryPlainText(P('Un <mark data-hl="#ff0">passage</mark>  gras'))).toBe('Un passage gras')
  })
  it('joint les items d’une liste', () => {
    expect(entryPlainText({ type: 'list', items: [{ text: 'a' }, { text: 'b' }] })).toBe('a b')
  })
})

describe('groupLiminairePages', () => {
  it('ouvre une page à chaque pageStart, la première sans saut', () => {
    const pages = groupLiminairePages([
      P('Titre', 'page'), // page 1
      P('sous-titre'), // rattaché
      P('Auteur', 'recto'), // page 2, recto
      P('Mentions', 'verso'), // page 3, verso
    ])
    expect(pages.map((p) => p.sideFromOdt)).toEqual(['auto', 'recto', 'verso'])
    expect(pages[0].entries).toHaveLength(2)
    expect(pages.map((p) => p.preview)).toEqual(['Titre', 'Auteur', 'Mentions'])
  })

  it('la toute première entrée ouvre la page 1 même sans pageStart', () => {
    const pages = groupLiminairePages([P('Faux-titre'), P('encore')])
    expect(pages).toHaveLength(1)
    expect(pages[0].entries).toHaveLength(2)
  })

  it('rend une liste vide sur une entrée absente', () => {
    expect(groupLiminairePages([])).toEqual([])
    expect(groupLiminairePages(undefined)).toEqual([])
  })
})

describe('deriveEligibility', () => {
  const pages = groupLiminairePages([P('Faux-titre'), P('Titre', 'recto'), P('© 2026', 'verso')])
  const [ft, ti, ml] = pages

  it('signale les obligatoires manquants', () => {
    const { obligatoires } = deriveEligibility(pages, { [ft.key]: { type: 'faux-titre' } })
    expect(obligatoires.find((o) => o.key === 'faux-titre').present).toBe(true)
    expect(obligatoires.find((o) => o.key === 'page-de-titre').present).toBe(false)
    expect(obligatoires.find((o) => o.key === 'mentions-legales').present).toBe(false)
  })

  it('détecte un côté choisi qui contredit la convention', () => {
    // mentions légales attendues en verso ; on la met en recto → conflit.
    const { conflicts } = deriveEligibility(pages, { [ml.key]: { type: 'mentions-legales', side: 'recto' } })
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({ type: 'mentions-legales', chosen: 'recto', expected: 'verso' })
  })

  it('« auto » ne contredit aucune convention', () => {
    const { conflicts } = deriveEligibility(pages, { [ml.key]: { type: 'mentions-legales', side: 'auto' } })
    expect(conflicts).toHaveLength(0)
  })

  it('repère un type conventionnel en double', () => {
    const { duplicates } = deriveEligibility(pages, {
      [ti.key]: { type: 'page-de-titre' },
      [ml.key]: { type: 'page-de-titre' },
    })
    expect(duplicates).toEqual([{ type: 'page-de-titre', label: 'Page de titre', count: 2 }])
  })
})

describe('pageKey', () => {
  it('stable pour le même texte, distinct sinon', () => {
    const a = groupLiminairePages([P('Faux-titre', 'page')])[0]
    const b = groupLiminairePages([P('Faux-titre', 'recto')])[0] // même texte, côté différent
    const c = groupLiminairePages([P('Autre', 'page')])[0]
    expect(a.key).toBe(b.key) // la clé ne dépend que du texte, pas du côté
    expect(a.key).not.toBe(c.key)
    expect(a.key).toMatch(/^lp_/)
  })
})
