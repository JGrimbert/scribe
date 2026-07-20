import { describe, it, expect } from 'vitest'
import {
  LIMINAIRE_PAGES,
  groupLiminairePages,
  withEntryKeys,
  entryPlainText,
  sideOfPageStart,
  deriveEligibility,
  effectiveSide,
  computeImposition,
  toSpreads,
  toggleBreak,
  setPageSide,
  isConflicting,
  pagesOfSpread,
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

describe('computeImposition / toSpreads', () => {
  const pg = (side = 'auto', sideFromOdt = 'auto', isBlank = false) => ({ side, sideFromOdt, isBlank })

  it('numérote séquentiellement recto/verso sans contrainte', () => {
    const slots = computeImposition([pg(), pg(), pg()])
    expect(slots.map((s) => [s.number, s.parity, s.blank])).toEqual([
      [1, 'recto', false],
      [2, 'verso', false],
      [3, 'recto', false],
    ])
  })

  it('insère une blanche implicite pour tenir une contrainte recto', () => {
    // page 2 veut recto mais tomberait en verso (n°2) → blanche implicite, page en n°3.
    const slots = computeImposition([pg('auto'), pg('recto')])
    expect(slots.map((s) => [s.number, s.blank, s.implicit || false])).toEqual([
      [1, false, false],
      [2, true, true],
      [3, false, false],
    ])
  })

  it('une blanche de tête devient couverture ; le contenu commence page 1 recto', () => {
    const slots = computeImposition([pg('auto', 'verso', true), pg('auto')])
    expect(slots.find((s) => s.cover)).toBeTruthy()
    const content = slots.find((s) => !s.blank)
    expect([content.number, content.parity]).toEqual([1, 'recto'])
  })

  it('ABSORBE une blanche mal placée plutôt que d’en doubler une', () => {
    // contenu(n1 recto), blanche(n2), page voulant verso : n3 serait recto. La
    // blanche qui précède est mal placée → absorbée, la page reprend n2 = verso.
    // « La convention l’emporte sur les blanches du .odt. »
    const slots = computeImposition([pg(), pg('auto', 'auto', true), pg('verso')])
    expect(slots.filter((s) => s.blank).length).toBe(0)
    const last = slots[slots.length - 1]
    expect([last.number, last.parity]).toEqual([2, 'verso'])
  })

  it('la convention du type (typeSide) sert d’ancre quand aucun côté n’est choisi', () => {
    // page 2 est taguée page-de-titre (typeSide recto) mais tomberait en verso →
    // blanche implicite, la page de titre repasse recto.
    const slots = computeImposition([pg(), { side: 'auto', sideFromOdt: 'auto', isBlank: false, typeSide: 'recto' }])
    expect(slots.map((s) => [s.number, s.blank, s.implicit || false])).toEqual([
      [1, false, false],
      [2, true, true],
      [3, false, false],
    ])
  })

  it('le côté choisi et le .odt priment sur la convention du type', () => {
    // typeSide recto, mais côté CHOISI verso → verso l’emporte (pas de blanche).
    expect(effectiveSide({ side: 'verso', typeSide: 'recto' })).toBe('verso')
    // typeSide recto, .odt réel verso → le .odt l’emporte.
    expect(effectiveSide({ side: 'auto', sideFromOdt: 'verso', typeSide: 'recto' })).toBe('verso')
    // rien de choisi ni .odt → la convention du type parle.
    expect(effectiveSide({ side: 'auto', sideFromOdt: 'auto', typeSide: 'recto' })).toBe('recto')
  })

  it('planches : recto seul en tête, puis paires verso|recto', () => {
    const sp = toSpreads(computeImposition([pg(), pg(), pg()]))
    expect(sp[0].left).toBeNull()
    expect(sp[0].right.number).toBe(1)
    expect(sp[1].left.number).toBe(2)
    expect(sp[1].right.number).toBe(3)
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

describe('accès à la config de tagging', () => {
  it('retire une frontière déjà posée et nettoie une entrée devenue vide', () => {
    const config = { le_a: { break: 'joined' } }
    toggleBreak(config, 'le_a', 'joined')
    expect(config.le_a).toBeUndefined()
  })

  it('garde l’entrée si elle porte encore un type ou un côté', () => {
    const config = { le_a: { break: 'start', type: 'dedicace' } }
    toggleBreak(config, 'le_a', 'start')
    expect(config.le_a).toEqual({ type: 'dedicace' })
  })

  it('remplace une frontière par l’autre plutôt que de la retirer', () => {
    const config = {}
    toggleBreak(config, 'le_a', 'start')
    toggleBreak(config, 'le_a', 'joined')
    expect(config.le_a.break).toBe('joined')
  })

  it('efface le côté quand il repasse à auto, sans effacer le type', () => {
    const config = { le_a: { type: 'dedicace', side: 'verso' } }
    setPageSide(config, { key: 'le_a' }, 'auto')
    expect(config.le_a).toEqual({ type: 'dedicace', side: undefined })
  })

  it('signale un conflit seulement quand un côté choisi contredit la convention', () => {
    const page = { key: 'le_a' }
    // Mentions légales : verso par convention.
    expect(isConflicting({ le_a: { type: 'mentions-legales', side: 'recto' } }, page)).toBe(true)
    expect(isConflicting({ le_a: { type: 'mentions-legales', side: 'auto' } }, page)).toBe(false)
    expect(isConflicting({ le_a: { side: 'recto' } }, page)).toBe(false)
  })
})

describe('pagesOfSpread', () => {
  const page = (key) => ({ key })

  it('rend les deux pages réelles, verso puis recto', () => {
    const spread = { left: { page: page('a') }, right: { page: page('b') } }
    expect(pagesOfSpread(spread).map((p) => p.key)).toEqual(['a', 'b'])
  })

  it('écarte la couverture et les blanches implicites — elles ne se découpent pas', () => {
    const spread = { left: { cover: true, blank: true }, right: { blank: true, implicit: true } }
    expect(pagesOfSpread(spread)).toEqual([])
  })

  it('garde une blanche EXPLICITE, qui vient bien d’une entrée du .odt', () => {
    const spread = { left: { blank: true, page: page('vide') }, right: null }
    expect(pagesOfSpread(spread).map((p) => p.key)).toEqual(['vide'])
  })

  it('rend une liste vide sur le cran terminal (aucun vis-à-vis)', () => {
    expect(pagesOfSpread(undefined)).toEqual([])
  })
})
