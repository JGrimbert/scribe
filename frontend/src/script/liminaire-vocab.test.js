import { describe, it, expect } from 'vitest'
import { LIMINAIRE_PAGES, sideOfPageStart } from './liminaire-vocab'

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
