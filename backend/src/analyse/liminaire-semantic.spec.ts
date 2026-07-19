import { describe, it, expect } from 'vitest'
import { pickBestTypes, wordCount, LIMINAIRE_TYPE_DESCRIPTIONS } from './liminaire-semantic'

describe('LIMINAIRE_TYPE_DESCRIPTIONS', () => {
  it('couvre les 16 types', () => {
    expect(LIMINAIRE_TYPE_DESCRIPTIONS).toHaveLength(16)
    expect(LIMINAIRE_TYPE_DESCRIPTIONS.map((d) => d.key)).toContain('avant-propos')
  })
})

describe('pickBestTypes', () => {
  const descs = [{ key: 'preface' }, { key: 'avant-propos' }]

  it('retient le plus proche au-dessus du seuil, arrondi', () => {
    // 2 pages, descriptions aux colonnes 2 et 3.
    const matrix = [
      [1, 0, 0.2, 0.391], // page 0 → avant-propos (0.391)
      [1, 0, 0.1, 0.05], // page 1 → rien (max 0.1 < seuil)
    ]
    const picks = pickBestTypes(matrix, 2, descs, 0.33)
    expect(picks[0]).toEqual({ type: 'avant-propos', score: 0.391 })
    expect(picks[1]).toBeNull()
  })

  it('un seuil plus haut rejette un match faible', () => {
    const matrix = [[1, 0.34, 0.1]]
    expect(pickBestTypes(matrix, 1, descs, 0.33)[0]).toEqual({ type: 'preface', score: 0.34 })
    expect(pickBestTypes(matrix, 1, descs, 0.4)[0]).toBeNull()
  })
})

describe('wordCount', () => {
  it('compte les mots, ignore les espaces multiples', () => {
    expect(wordCount('  un   deux trois ')).toBe(3)
    expect(wordCount('')).toBe(0)
  })
})
