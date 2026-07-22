import { describe, it, expect } from 'vitest'
import { groupLiminairePages, withEntryKeys, entryPlainText } from './liminaire-pages'

const P = (text, pageStart) => ({ type: 'paragraph', text, ...(pageStart ? { pageStart } : {}) })

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

  it('SCINDE sur un changement de type de style, sans saut .odt (mentions → dédicace)', () => {
    // Le cas du témoin : le copyright et « Pour Margot » se suivent SANS saut de
    // page, mais leurs styles nomment deux types différents.
    const entries = [
      { type: 'paragraph', text: 'Tous droits réservés', styleName: 'mentions légales' },
      { type: 'paragraph', text: 'ISBN : 888', styleName: 'mentions légales' },
      { type: 'paragraph', text: 'Pour Margot', styleName: 'Dédicace' },
    ]
    const pages = groupLiminairePages(entries)
    expect(pages).toHaveLength(2)
    expect(pages[0].entries).toHaveLength(2)
    expect(pages[1].preview).toBe('Pour Margot')
  })

  it('un style ANONYME ne scinde rien (la page de titre reste groupée)', () => {
    // Auteur / Title / « mention sous titre » / ornement : aucun ne nomme un type
    // liminaire → une seule page, comme dans le .odt témoin.
    const entries = [
      { type: 'paragraph', text: 'Jean Grimbert', styleName: 'Auteur' },
      { type: 'paragraph', text: 'JŌHĀNĀN & MARVĀRĪD', styleName: 'Title' },
      { type: 'paragraph', text: 'Essai', styleName: 'mention sous titre' },
      { type: 'paragraph', text: 'a', styleName: 'Ornementation page titre' },
    ]
    expect(groupLiminairePages(entries)).toHaveLength(1)
  })

  it('la fusion manuelle (joined) désarme la scission par style', () => {
    const entries = [
      { type: 'paragraph', text: 'Tous droits réservés', styleName: 'mentions légales' },
      { type: 'paragraph', text: 'Pour Margot', styleName: 'Dédicace' },
    ]
    const keyed = withEntryKeys(entries)
    const merged = groupLiminairePages(entries, { [keyed[1].key]: { break: 'joined' } })
    expect(merged).toHaveLength(1)
  })

  it('rend une liste vide sur une entrée absente', () => {
    expect(groupLiminairePages([])).toEqual([])
    expect(groupLiminairePages(undefined)).toEqual([])
  })
})
