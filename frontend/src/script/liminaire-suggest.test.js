import { describe, it, expect } from 'vitest'
import { suggestLiminaireType, suggestAll } from './liminaire-suggest'

// Une page minimale : ses entrées (texte + style) suffisent au moteur.
const page = (entries, extra = {}) => ({
  key: 'k',
  isBlank: false,
  entries: entries.map((e) => (typeof e === 'string' ? { type: 'paragraph', text: e } : { type: 'paragraph', ...e })),
  ...extra,
})

describe('suggestLiminaireType', () => {
  it('nom de style « mentions » l’emporte', () => {
    expect(suggestLiminaireType(page([{ text: 'Bla', styleName: 'mentions légales' }])))
      .toMatchObject({ key: 'mentions-legales', why: expect.stringContaining('style') })
  })

  it('ISBN / copyright → mentions légales', () => {
    expect(suggestLiminaireType(page(['ISBN : 888-88', 'Tous droits réservés'])).key).toBe('mentions-legales')
  })

  it('« Pour Margot » court → dédicace', () => {
    expect(suggestLiminaireType(page(['Pour Margot'])).key).toBe('dedicace')
  })

  it('mots-clés francs', () => {
    expect(suggestLiminaireType(page(['Table des matières'])).key).toBe('table-des-matieres')
    expect(suggestLiminaireType(page(['Avant-propos'])).key).toBe('avant-propos')
    expect(suggestLiminaireType(page(['Remerciements'])).key).toBe('remerciements')
  })

  it('titre seul → faux-titre ; titre + auteur → page de titre', () => {
    const ctx = { title: 'JŌHĀNĀN & MARVĀRĪD' }
    expect(suggestLiminaireType(page(['JŌHĀNĀN & MARVĀRĪD']), ctx).key).toBe('faux-titre')
    expect(suggestLiminaireType(page(['Jean Grimbert', 'JŌHĀNĀN & MARVĀRĪD', 'Essai']), ctx).key).toBe('page-de-titre')
  })

  it('ne devine pas le flou (Introduction) ni une page blanche', () => {
    expect(suggestLiminaireType(page(['Introduction', 'Pourquoi écrire…']))).toBeNull()
    expect(suggestLiminaireType({ isBlank: true, entries: [] })).toBeNull()
  })
})

describe('suggestAll', () => {
  it('keye par page.key et écarte les pages sans suggestion', () => {
    const pages = [
      { key: 'a', isBlank: false, entries: [{ type: 'paragraph', text: 'ISBN : 1' }] },
      { key: 'b', isBlank: false, entries: [{ type: 'paragraph', text: 'Introduction' }] },
      { key: 'c', isBlank: true, entries: [] },
    ]
    const all = suggestAll(pages)
    expect(Object.keys(all)).toEqual(['a'])
    expect(all.a.key).toBe('mentions-legales')
  })
})
