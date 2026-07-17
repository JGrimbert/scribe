import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RULES,
  DocumentRules,
  depthKeyOf,
  hasPerDepthRules,
  normalizeRules,
  rulesErrors,
  rulesFor,
} from './rules'

const set = (over = {}) => ({ minChars: null, forbidAnnotations: false, requiresRoles: [], requiresTable: false, ...over })

describe('depthKeyOf', () => {
  it('plafonne à 2 : au-delà, tout est « article »', () => {
    expect(depthKeyOf(0)).toBe(0)
    expect(depthKeyOf(1)).toBe(1)
    expect(depthKeyOf(2)).toBe(2)
    expect(depthKeyOf(7)).toBe(2)
  })
})

describe('rulesFor', () => {
  const rules: DocumentRules = { default: set({ minChars: 100 }), byDepth: { 2: set({ minChars: 500 }) } }

  it('retient le jeu de la profondeur quand il existe', () => {
    expect(rulesFor(rules, 2).minChars).toBe(500)
    expect(rulesFor(rules, 5).minChars).toBe(500) // profondeur ≥ 2
  })

  it('retombe sur le défaut sinon', () => {
    expect(rulesFor(rules, 0).minChars).toBe(100)
    expect(rulesFor(rules, 1).minChars).toBe(100)
  })

  it('remplace le défaut, ne le complète pas', () => {
    // Pas d'héritage partiel : sans ça, on ne pourrait pas RETIRER un critère
    // à une profondeur donnée.
    const r: DocumentRules = { default: set({ forbidAnnotations: true, minChars: 500 }), byDepth: { 0: set() } }
    expect(rulesFor(r, 0)).toEqual(set())
  })
})

describe('normalizeRules — compatibilité', () => {
  it('remonte le format historique à plat en « default » sans rien perdre', () => {
    // Des documents en base portent ce format : le casser, c'est effacer des
    // réglages que l'utilisateur a pris le temps de poser.
    const legacy = { minChars: 500, forbidAnnotations: true, requiresRoles: ['définition'], requiresTable: true }
    expect(normalizeRules(legacy)).toEqual({
      default: { minChars: 500, forbidAnnotations: true, requiresRoles: ['définition'], requiresTable: true },
      byDepth: {},
    })
  })

  it('rend les DÉFAUTS pour une entrée nulle, pas des règles vides', () => {
    // Des règles vides déclareraient tout le monde conforme — le contraire d'un
    // défaut utile.
    expect(normalizeRules(null)).toEqual(DEFAULT_RULES)
    expect(normalizeRules(undefined)).toEqual(DEFAULT_RULES)
  })

  it('ne rend jamais l’objet DEFAULT_RULES partagé', () => {
    const a = normalizeRules(null)
    a.default.minChars = 1
    expect(DEFAULT_RULES.default.minChars).toBe(500)
    expect(normalizeRules(null).default.minChars).toBe(500)
  })

  it('distingue « jamais configuré » (null) de « tout décoché » ({})', () => {
    expect(normalizeRules(null).default.minChars).toBe(500)
    expect(normalizeRules({}).default.minChars).toBeNull()
  })

  it('normalise chaque jeu du format courant', () => {
    const body = { default: { minChars: 300 }, byDepth: { 0: { requiresTable: true } } }
    expect(normalizeRules(body)).toEqual({
      default: set({ minChars: 300 }),
      byDepth: { 0: set({ requiresTable: true }) },
    })
  })

  it('écarte une profondeur hors barème plutôt que de l’installer en base', () => {
    expect(normalizeRules({ default: set(), byDepth: { 9: set({ minChars: 10 }) } }).byDepth).toEqual({})
  })
})

describe('hasPerDepthRules', () => {
  it('distingue le cas nominal d’un réglage par niveau', () => {
    expect(hasPerDepthRules(DEFAULT_RULES)).toBe(false)
    expect(hasPerDepthRules({ default: set(), byDepth: { 2: set() } })).toBe(true)
  })
})

describe('rulesErrors', () => {
  it('accepte les deux formats valides', () => {
    expect(rulesErrors({ minChars: 500, forbidAnnotations: true })).toEqual([])
    expect(rulesErrors({ default: { minChars: 500 }, byDepth: { 2: { requiresRoles: ['citation'] } } })).toEqual([])
  })

  it('refuse un minChars non entier, dans le défaut comme par profondeur', () => {
    expect(rulesErrors({ default: { minChars: -1 } })).toHaveLength(1)
    expect(rulesErrors({ default: {}, byDepth: { 2: { minChars: 1.5 } } })[0]).toContain('Articles')
  })

  it('refuse un rôle hors vocabulaire', () => {
    // Le vocabulaire est fermé exprès : une étiquette libre, c'est une règle
    // cassée en silence.
    expect(rulesErrors({ default: { requiresRoles: ['inventé'] } })[0]).toContain('inventé')
  })

  it('refuse une profondeur hors barème', () => {
    expect(rulesErrors({ default: {}, byDepth: { 9: {} } })[0]).toContain('Profondeur inconnue')
  })

  it('nomme la profondeur fautive pour que l’erreur soit actionnable', () => {
    expect(rulesErrors({ default: {}, byDepth: { 0: { requiresRoles: ['nope'] } } })[0]).toContain('Axes')
  })
})
