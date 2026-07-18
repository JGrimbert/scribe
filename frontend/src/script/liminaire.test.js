import { describe, it, expect } from 'vitest'
import {
  LIMINAIRE_PAGES,
  groupLiminairePages,
  withEntryKeys,
  entryPlainText,
  sideOfPageStart,
  deriveEligibility,
} from './liminaire'

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

describe('withEntryKeys', () => {
  it('désambiguïse les textes répétés et marque les vides', () => {
    const keyed = withEntryKeys([P('Titre'), P('Titre'), P('', 'verso')])
    expect(keyed[0].key).not.toBe(keyed[1].key) // même texte, occurrences distinctes
    expect(keyed[2].isBlank).toBe(true)
    expect(keyed[0].isBlank).toBe(false)
  })
  it('clé stable pour le même (texte, occurrence)', () => {
    expect(withEntryKeys([P('X')])[0].key).toBe(withEntryKeys([P('X')])[0].key)
  })
})

describe('groupLiminairePages', () => {
  it('ouvre une page à chaque pageStart, la première sans saut', () => {
    const pages = groupLiminairePages([P('Titre', 'page'), P('sous-titre'), P('Auteur', 'recto'), P('Mentions', 'verso')])
    expect(pages.map((p) => p.sideFromOdt)).toEqual(['auto', 'recto', 'verso'])
    expect(pages[0].entries).toHaveLength(2)
    expect(pages.map((p) => p.preview)).toEqual(['Titre', 'Auteur', 'Mentions'])
  })

  it('marque une page sans contenu comme blanche', () => {
    const pages = groupLiminairePages([P('', 'verso'), P('Faux-titre', 'page')])
    expect(pages[0].isBlank).toBe(true)
    expect(pages[0].sideFromOdt).toBe('verso')
    expect(pages[1].isBlank).toBe(false)
  })

  it('FUSION : break=joined rattache une page à la précédente', () => {
    const entries = [P('Jean Grimbert', 'page'), P('Titre', 'page'), P('Essai', 'page')]
    const keyed = withEntryKeys(entries)
    // Sans override : 3 pages. Avec joined sur « Titre » et « Essai » : 1 page.
    expect(groupLiminairePages(entries)).toHaveLength(3)
    const config = { [keyed[1].key]: { break: 'joined' }, [keyed[2].key]: { break: 'joined' } }
    const merged = groupLiminairePages(entries, config)
    expect(merged).toHaveLength(1)
    expect(merged[0].entries).toHaveLength(3)
  })

  it('SCISSION : break=start ouvre une page sans saut .odt', () => {
    const entries = [P('Mentions'), P('Pour Margot')] // aucun pageStart → 1 page
    const keyed = withEntryKeys(entries)
    expect(groupLiminairePages(entries)).toHaveLength(1)
    const split = groupLiminairePages(entries, { [keyed[1].key]: { break: 'start' } })
    expect(split).toHaveLength(2)
    expect(split.map((p) => p.preview)).toEqual(['Mentions', 'Pour Margot'])
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

  it('ignore les pages blanches', () => {
    const withBlank = groupLiminairePages([P('', 'verso'), P('Faux-titre', 'page')])
    const { assigned } = deriveEligibility(withBlank, {})
    expect(assigned).toHaveLength(1) // la page blanche est écartée
  })
})
