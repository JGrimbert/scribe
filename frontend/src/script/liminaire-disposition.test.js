import { describe, it, expect } from 'vitest'
import { groupLiminairePages, withEntryKeys } from './liminaire-pages'
import { computeImposition, toSpreads, dispositionByStyle } from './liminaire-imposition'

// ─────────────────────────────────────────────────────────────────────────────
// Cahier de cas — modèle liminaire (regroupement + imposition + disposition).
// Fixture FIDÈLE à la structure liminaire du témoin « Johanan » (lue via
// GET /documents/:id). Le document est MAL FORMÉ : les « pages blanches » ne sont
// pas des pages explicites mais des paragraphes VIDES porteurs d'un saut — à traiter
// comme de vraies pages vides. Chaque `pageStart` reproduit celui du .odt.
// ─────────────────────────────────────────────────────────────────────────────
const E = (styleName, text = 'x', pageStart) => ({
  type: 'paragraph', text, ...(styleName ? { styleName } : {}), ...(pageStart ? { pageStart } : {}),
})
const BLANK = (pageStart) => ({ type: 'paragraph', text: '', ...(pageStart ? { pageStart } : {}) })

// Ordre de lecture du liminaire Johanan (indices utiles cités dans les cas).
function johanan() {
  return [
    /* 0  */ BLANK('verso'),                           // garde (intérieur de couverture)
    /* 1  */ E('Header left', 'Faux-titre', 'page'),   // faux-titre
    /* 2  */ BLANK('page'),                             // blanche avant le titre
    /* 3  */ E('Auteur', 'Jean Grimbert', 'page'),     // page de titre (élément d'ouverture)
    /* 4  */ E('Title', 'JOHANAN'),
    /* 5  */ E('mention sous titre', 'Essai'),
    /* 6  */ E('Ornementation page titre', 'a'),
    /* 7  */ BLANK('page'),                             // VIDE absorbé (avant mentions)
    /* 8  */ E('mentions légales', 'Tous droits'),
    /* 9  */ E('mentions légales', 'reproduction'),
    /* 10 */ E('mentions légales', 'code'),
    /* 11 */ E('mentions légales', 'ISBN'),
    /* 12 */ E('Dédicace', 'Pour Margot'),             // scinde via type (mentions → dédicace)
    /* 13 */ BLANK('page'),                             // blanche avant l'épigraphe
    /* 14 */ BLANK('page'),                             // VIDE absorbé
    /* 15 */ E('Citation liminaire', 'Si fractus'),    // épigraphe
    /* 16 */ BLANK('page'),                             // blanche avant l'introduction
    /* 17 */ E('Paragraphes', 'Introduction', 'page'), // introduction (élément d'ouverture)
    /* 18 */ E('Paragraphes', 'Pourquoi'),
    /* 19 */ E('Paragraphes', 'Si j’ai appris'),
  ]
}

// Étiquette d'une cellule d'un vis-à-vis : couverture / blanche / aperçu du contenu.
const lab = (c) => (!c ? '.' : c.cover ? 'garde' : c.blank ? 'BLANCHE' : c.page.preview || '?')
// Vis-à-vis rendus [ [gauche/verso, droite/recto], … ] à partir des entrées + config.
const folia = (entries, config = {}) =>
  toSpreads(computeImposition(groupLiminairePages(entries, config))).map((sp) => [lab(sp.left), lab(sp.right)])
// Config par ÉLÉMENT à partir d'indices dans la liste d'entrées : { i: disposition }.
const cfg = (entries, byIndex) => {
  const keyed = withEntryKeys(entries)
  const out = {}
  for (const [i, disposition] of Object.entries(byIndex)) out[keyed[Number(i)].key] = { disposition }
  return out
}

describe('DÉFAUT — reproduit la table OpenOffice', () => {
  it('les 5 vis-à-vis attendus (mentions | dédicace côte à côte, blanches aux bons endroits)', () => {
    expect(folia(johanan())).toEqual([
      ['garde', 'Faux-titre'],
      ['BLANCHE', 'Jean Grimbert'], // page de titre
      ['Tous droits', 'Pour Margot'], // mentions | dédicace
      ['BLANCHE', 'Si fractus'], // épigraphe
      ['BLANCHE', 'Introduction'],
    ])
  })

  it('les VIDES absorbés (avant mentions, 2e avant épigraphe) ne font PAS de folio blanc', () => {
    // 4 blanches attendues (garde + 3), pas 6 : deux vides sont absorbés dans leur page.
    const slots = computeImposition(groupLiminairePages(johanan()))
    expect(slots.filter((s) => s.blank).length).toBe(4)
  })
})

describe('DISPOSITION EFFECTIVE affichée par le select (défaut)', () => {
  it('ouvreur avec blanche avant = belle page ; sans = saut ; élément interne = continu', () => {
    const m = dispositionByStyle(groupLiminairePages(johanan()))
    const d = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.disposition]))
    expect(d).toEqual({
      'Header left': 'break', // faux-titre : face à la garde (≠ blanche) → saut
      Auteur: 'blank', // page de titre : blanche avant → belle page
      Title: 'none',
      'mention sous titre': 'none',
      'Ornementation page titre': 'none',
      'mentions légales': 'break', // face au titre → saut
      Dédicace: 'break', // face aux mentions → saut
      'Citation liminaire': 'blank', // épigraphe : blanche avant → belle page
      Paragraphes: 'blank', // introduction : blanche avant → belle page
    })
  })

  it('la clé ciblée est bien la 1re occurrence du style (l’ouvreur de sa page)', () => {
    const keyed = withEntryKeys(johanan())
    const m = dispositionByStyle(groupLiminairePages(johanan()))
    expect(m['Dédicace'].key).toBe(keyed[12].key)
    expect(m['mentions légales'].key).toBe(keyed[8].key) // 1re des 4 lignes
    expect(m['Paragraphes'].key).toBe(keyed[17].key) // « Introduction », pas un paragraphe suivant
  })
})

describe('CONTINU (l’élément recolle à la page précédente)', () => {
  it('Dédicace → continu : la dédicace fond dans la page des mentions', () => {
    const f = folia(johanan(), cfg(johanan(), { 12: 'none' }))
    // La dédicace n’a plus de folio propre ; tout ce qui suit se décale d’un folio.
    expect(f).toEqual([
      ['garde', 'Faux-titre'],
      ['BLANCHE', 'Jean Grimbert'],
      ['Tous droits', 'BLANCHE'], // mentions (+dédicace absorbée) | blanche
      ['Si fractus', 'BLANCHE'], // épigraphe décalée au verso
      ['Introduction', '.'],
    ])
  })

  it('Auteur → continu : la page de titre remonte, sa blanche d’avant est absorbée', () => {
    const f = folia(johanan(), cfg(johanan(), { 3: 'none' }))
    expect(f[1]).toEqual(['Jean Grimbert', 'Tous droits']) // titre | mentions, plus de blanche
  })
})

describe('SAUT DE PAGE (nouveau folio, sans blanche)', () => {
  it('Title (interne à la page de titre) → saut : scinde le titre', () => {
    const pages = groupLiminairePages(johanan(), cfg(johanan(), { 4: 'break' }))
    const previews = pages.filter((p) => !p.isBlank).map((p) => p.preview)
    // « Jean Grimbert » (Auteur) puis « JOHANAN » (Title) sont désormais deux pages.
    expect(previews).toContain('Jean Grimbert')
    expect(previews).toContain('JOHANAN')
    const iA = previews.indexOf('Jean Grimbert')
    expect(previews[iA + 1]).toBe('JOHANAN')
  })

  it('saut de page n’insère aucune blanche', () => {
    const before = computeImposition(groupLiminairePages(johanan())).filter((s) => s.blank).length
    const after = computeImposition(groupLiminairePages(johanan(), cfg(johanan(), { 4: 'break' }))).filter((s) => s.blank).length
    expect(after).toBe(before)
  })
})

describe('BELLE PAGE (nouveau folio + blanche, texte à droite/recto)', () => {
  it('Dédicace → belle page : la dédicace tombe à DROITE (recto)', () => {
    const slots = computeImposition(groupLiminairePages(johanan(), cfg(johanan(), { 12: 'blank' })))
    const ded = slots.find((s) => !s.blank && s.page?.preview === 'Pour Margot')
    expect(ded.parity).toBe('recto')
    // Le folio juste avant la dédicace est une blanche.
    const prev = slots[slots.indexOf(ded) - 1]
    expect(prev.blank).toBe(true)
  })

  it('déjà au recto → 2 blanches pour l’amener au recto SUIVANT (la dédicace l’est)', () => {
    // Défaut : dédicace au recto (folio 5). Belle page → 2 blanches insérées.
    const before = computeImposition(groupLiminairePages(johanan())).filter((s) => s.blank).length
    const after = computeImposition(groupLiminairePages(johanan(), cfg(johanan(), { 12: 'blank' }))).filter((s) => s.blank).length
    expect(after - before).toBe(2)
  })
})

describe('ROUND-TRIP — le select relit ce qu’il a réglé', () => {
  it('après « continu » sur la dédicace, sa disposition effective devient continu', () => {
    const config = cfg(johanan(), { 12: 'none' })
    const m = dispositionByStyle(groupLiminairePages(johanan(), config))
    expect(m['Dédicace'].disposition).toBe('none')
  })

  it('après « belle page » sur la dédicace, sa disposition effective devient belle page', () => {
    const config = cfg(johanan(), { 12: 'blank' })
    const m = dispositionByStyle(groupLiminairePages(johanan(), config))
    expect(m['Dédicace'].disposition).toBe('blank')
  })
})
