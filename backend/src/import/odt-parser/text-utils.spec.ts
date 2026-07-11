import { describe, it, expect } from 'vitest'
import { slugify, makeUniqueSlug, extractRomain, computeStats } from './text-utils'

describe('slugify', () => {
  it('retire les diacritiques et met en kebab-case', () => {
    expect(slugify('Château de Sublime !')).toBe('chateau-de-sublime')
  })

  it('rogne les tirets de bord et vide les caractères non alphanumériques', () => {
    expect(slugify('  --Été 2026--  ')).toBe('ete-2026')
  })

  it('tronque à 80 caractères', () => {
    expect(slugify('a'.repeat(200))).toHaveLength(80)
  })

  it('renvoie une chaîne vide quand rien n’est slugifiable', () => {
    expect(slugify('!!! ??? …')).toBe('')
  })
})

describe('makeUniqueSlug', () => {
  it('renvoie le slug de base au premier usage', () => {
    const used = new Set<string>()
    expect(makeUniqueSlug('Mon Titre', used, 'titre-1')).toBe('mon-titre')
    expect(used.has('mon-titre')).toBe(true)
  })

  it('suffixe -2, -3… en cas de collision', () => {
    const used = new Set<string>()
    expect(makeUniqueSlug('Bloc', used, 'x')).toBe('bloc')
    expect(makeUniqueSlug('Bloc', used, 'x')).toBe('bloc-2')
    expect(makeUniqueSlug('Bloc', used, 'x')).toBe('bloc-3')
  })

  it('retombe sur le préfixe de secours si le texte ne produit aucun slug', () => {
    const used = new Set<string>()
    expect(makeUniqueSlug('###', used, 'titre-7')).toBe('titre-7')
  })
})

describe('computeStats', () => {
  it('compte 0 mot et statut "vide" sur une chaîne vide', () => {
    expect(computeStats('')).toEqual({ mots: 0, caracteres: 0, paragraphes: 0, status: 'vide' })
  })

  it('compte mots (espaces) et caractères (hors blancs)', () => {
    const stats = computeStats('un deux trois')
    expect(stats.mots).toBe(3)
    expect(stats.caracteres).toBe(11) // "undeuxtrois"
    expect(stats.paragraphes).toBe(1)
  })

  it('compte les paragraphes séparés par une ligne vide', () => {
    expect(computeStats('a b\n\nc d\n\ne f').paragraphes).toBe(3)
  })

  it('applique les seuils de statut (ébauche < 50 ≤ partiel < 200 ≤ rédigé)', () => {
    expect(computeStats(Array(10).fill('mot').join(' ')).status).toBe('ébauche')
    expect(computeStats(Array(100).fill('mot').join(' ')).status).toBe('partiel')
    expect(computeStats(Array(250).fill('mot').join(' ')).status).toBe('rédigé')
  })
})

describe('extractRomain', () => {
  it('extrait un chiffre romain en tête de chaîne, normalisé en majuscules', () => {
    expect(extractRomain('xiv machin')).toBe('XIV')
    expect(extractRomain('MCMLxxxiv')).toBe('MCMLXXXIV')
  })

  it('renvoie null sur une chaîne vide', () => {
    expect(extractRomain('')).toBeNull()
  })

  // Caractérisation d'un comportement bancal existant : à cause du \b initial,
  // le match vide en position 0 l'emporte dès que le premier mot n'est pas
  // exactement un chiffre romain — même "Chapitre IV" renvoie "". Sans
  // conséquence : numeroRomain est calculé sur ParsedNode puis abandonné par
  // harmonize (absent de HarmonizedItem). Verrouillé tel quel, pas corrigé ici.
  it('renvoie "" quand le chiffre romain n’est pas en tout début de chaîne', () => {
    expect(extractRomain('Chapitre IV')).toBe('')
    expect(extractRomain('Livre II : la suite')).toBe('')
  })
})
