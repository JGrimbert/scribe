import { describe, it, expect } from 'vitest'
import { toggleBreak, setPageSide, isConflicting } from './liminaire-config'

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
