import { describe, it, expect } from 'vitest'
import { dominantZone, groupByZone, hasZones, totalOf, zoneSegments, UNZONED } from './zones'

const style = (name, byZone, count) => ({ name, byZone, count: count ?? totalOf(byZone), headings: 0, sample: '' })

describe('dominantZone', () => {
  it('retient la zone où le style pèse le plus', () => {
    expect(dominantZone({ liminaire: 10, 'depth-2+': 1591, 'depth-1': 8 })).toBe('depth-2+')
    expect(dominantZone({ liminaire: 1 })).toBe('liminaire')
  })

  it('tranche une égalité par l’ordre de lecture', () => {
    expect(dominantZone({ 'depth-2+': 5, 'depth-0': 5 })).toBe('depth-0')
  })

  it('range les styles sans ventilation en « non situés »', () => {
    expect(dominantZone({})).toBe(UNZONED.key)
    expect(dominantZone(undefined)).toBe(UNZONED.key)
    expect(dominantZone({ liminaire: 0 })).toBe(UNZONED.key)
  })
})

describe('zoneSegments', () => {
  it('rend les cinq zones dans l’ordre de lecture, zéros compris', () => {
    const segments = zoneSegments({ 'depth-1': 3 })
    expect(segments.map((s) => s.key)).toEqual(['liminaire', 'depth-0', 'depth-1', 'depth-2+', 'final'])
    expect(segments.map((s) => s.value)).toEqual([0, 0, 3, 0, 0])
    expect(segments.every((s) => s.color && s.label)).toBe(true)
  })
})

describe('groupByZone', () => {
  it('range chaque style dans sa zone dominante, une seule fois', () => {
    const styles = [
      style('Paragraphes', { liminaire: 10, 'depth-1': 8, 'depth-2+': 1591 }),
      style('Dédicace', { liminaire: 1 }),
      style('Voir', { 'depth-2+': 182, 'depth-1': 1 }),
      style('Heading 1', { 'depth-0': 10 }),
    ]
    const sections = groupByZone(styles)

    expect(sections.map((s) => s.zone.key)).toEqual(['liminaire', 'depth-0', 'depth-2+'])
    expect(sections[0].styles.map((s) => s.name)).toEqual(['Dédicace'])
    expect(sections[1].styles.map((s) => s.name)).toEqual(['Heading 1'])
    // Trié par poids dans la zone : Paragraphes (1591) devant Voir (182).
    expect(sections[2].styles.map((s) => s.name)).toEqual(['Paragraphes', 'Voir'])

    // Un style transverse apparaît UNE fois — sa ligne porte le v-model du rôle.
    const occurrences = sections.flatMap((s) => s.styles).filter((s) => s.name === 'Paragraphes')
    expect(occurrences).toHaveLength(1)
  })

  it('omet les sections vides', () => {
    expect(groupByZone([style('Dédicace', { liminaire: 1 })]).map((s) => s.zone.label)).toEqual(['Liminaire'])
  })

  it('regroupe les styles non ventilés dans « Non situés »', () => {
    // Le cas réel : « Horizontal Line », un filet — un paragraphe vide, compté
    // par l'inventaire mais jamais promu en nœud.
    const sections = groupByZone([style('Horizontal Line', {}, 4)])
    expect(sections).toHaveLength(1)
    expect(sections[0].zone.key).toBe(UNZONED.key)
    expect(sections[0].styles[0].count).toBe(4)
  })

  it('départage par count global à poids égal dans la zone', () => {
    const sections = groupByZone([style('B', { liminaire: 1 }, 3), style('A', { liminaire: 1 }, 9)])
    expect(sections[0].styles.map((s) => s.name)).toEqual(['A', 'B'])
  })

  it('trie par ordre d’apparition quand firstIndex est présent', () => {
    const s = (name, byZone, firstIndex) => ({ name, byZone, count: totalOf(byZone), headings: 0, sample: '', firstIndex })
    // « Tard » pèse plus lourd mais apparaît après « Tôt » : l'ordre d'apparition
    // l'emporte sur la fréquence.
    const sections = groupByZone([s('Tard', { 'depth-2+': 100 }, 5), s('Tôt', { 'depth-2+': 2 }, 1)])
    expect(sections[0].styles.map((x) => x.name)).toEqual(['Tôt', 'Tard'])
  })
})

describe('hasZones', () => {
  it('distingue un import ventilé d’un import ancien', () => {
    expect(hasZones([style('a', { liminaire: 1 })])).toBe(true)
    expect(hasZones([{ name: 'a', count: 5, byZone: {} }])).toBe(false)
    // Import antérieur à la ventilation : byZone n'existe pas du tout.
    expect(hasZones([{ name: 'a', count: 5 }])).toBe(false)
  })
})
