import { describe, it, expect } from 'vitest'
import { deriveEligibility } from './liminaire-eligibilite'
import { groupLiminairePages } from './liminaire-pages'

const P = (text, pageStart) => ({ type: 'paragraph', text, ...(pageStart ? { pageStart } : {}) })

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
