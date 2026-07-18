import { describe, it, expect } from 'vitest'
import { aggregateByDepth, EMPTY_SIGNATURE, signatureLabel, toRoleRuns } from './shapes'

const shape = (nodeId, depth, runs, titre = nodeId) => ({ nodeId, titre, depth, isLeaf: true, runs, highlights: [] })

// Typologie de test : deux styles distincts partagent le rôle « corps ».
const roles = { Paragraphes: 'corps', 'Text body': 'corps', 'mention sous titre': 'définition', Voir: 'renvoi' }
const roleOf = (styleName) => roles[styleName] ?? 'corps'

describe('toRoleRuns', () => {
  it('refusionne deux styles voisins de même rôle', () => {
    // Tout l'intérêt des rôles : « corps ×5 », pas « corps ×2 · corps ×3 ».
    expect(toRoleRuns([['Paragraphes', 2], ['Text body', 3]], roleOf)).toEqual([['corps', 5]])
  })

  it('garde séparés deux rôles différents', () => {
    expect(toRoleRuns([['mention sous titre', 1], ['Paragraphes', 2]], roleOf)).toEqual([
      ['définition', 1],
      ['corps', 2],
    ])
  })
})

describe('signatureLabel', () => {
  it('n’affiche le multiplicateur qu’au-delà de 1', () => {
    // Le corps ne porte pas son ×N (bruit) ; les autres rôles, oui.
    expect(signatureLabel([['définition', 1], ['corps', 4]])).toBe('définition · corps')
    expect(signatureLabel([['chapeau', 2], ['corps', 3]])).toBe('chapeau×2 · corps')
  })

  it('nomme la forme vide', () => {
    expect(signatureLabel([])).toBe(EMPTY_SIGNATURE)
  })
})

describe('aggregateByDepth', () => {
  it('groupe par niveau sous les mêmes intitulés que le tableau des styles', () => {
    const groups = aggregateByDepth(
      [shape('a', 0, [['Paragraphes', 1]]), shape('b', 1, [['Paragraphes', 1]]), shape('c', 3, [['Paragraphes', 1]])],
      roleOf,
    )
    expect(groups.map((g) => g.zone.label)).toEqual([
      'Chapitrage — niveau 1',
      'Chapitrage — niveau 2',
      'Chapitrage — niveau 3+',
    ])
    // Profondeur 3 → « niveau 3+ » : au-delà de 2, tout est regroupé.
    expect(groups[2].total).toBe(1)
  })

  it('rassemble les nœuds de même forme en une signature', () => {
    const runs = [['mention sous titre', 1], ['Paragraphes', 2]]
    const groups = aggregateByDepth([shape('a', 2, runs), shape('b', 2, runs), shape('c', 2, [['Paragraphes', 1]])], roleOf)

    const [dominant, autre] = groups[0].signatures
    expect(dominant).toMatchObject({ label: 'définition · corps', count: 2, pct: 67 })
    expect(autre).toMatchObject({ label: 'corps', count: 1 })
    expect(dominant.nodes.map((n) => n.nodeId)).toEqual(['a', 'b'])
  })

  it('compte les nœuds vides à part et ne les propose jamais comme modèle', () => {
    // Le cas du témoin : « vide » est la forme la plus fréquente à tous les
    // niveaux (228 articles sur 818). En faire un modèle reviendrait à proposer
    // « un chapitre ne doit rien contenir ».
    const groups = aggregateByDepth([shape('a', 2, []), shape('b', 2, []), shape('c', 2, [['Paragraphes', 1]])], roleOf)

    expect(groups[0]).toMatchObject({ total: 3, empty: 2 })
    expect(groups[0].signatures.map((s) => s.label)).toEqual(['corps'])
    expect(groups[0].signatures.map((s) => s.label)).not.toContain(EMPTY_SIGNATURE)
  })

  it('rapporte les pourcentages aux nœuds ÉCRITS, pas au total', () => {
    // 1 seul nœud écrit sur 3 → sa forme régit 100 % de ce qui est rédigé.
    // Rapporté au total, elle passerait pour marginale (33 %).
    const groups = aggregateByDepth([shape('a', 2, []), shape('b', 2, []), shape('c', 2, [['Paragraphes', 1]])], roleOf)
    expect(groups[0].signatures[0].pct).toBe(100)
  })

  it('trie par effectif décroissant', () => {
    const groups = aggregateByDepth(
      [
        shape('a', 2, [['Voir', 1]]),
        shape('b', 2, [['Paragraphes', 1]]),
        shape('c', 2, [['Paragraphes', 1]]),
        shape('d', 2, [['Paragraphes', 1]]),
      ],
      roleOf,
    )
    expect(groups[0].signatures.map((s) => [s.label, s.count])).toEqual([
      ['corps', 3],
      ['renvoi', 1],
    ])
  })

  it('borne les exemples à cinq nœuds par signature', () => {
    const many = Array.from({ length: 12 }, (_, i) => shape(`n${i}`, 2, [['Paragraphes', 1]]))
    const groups = aggregateByDepth(many, roleOf)
    expect(groups[0].signatures[0].count).toBe(12)
    expect(groups[0].signatures[0].nodes).toHaveLength(5)
  })

  it('omet les niveaux sans aucun nœud', () => {
    const groups = aggregateByDepth([shape('a', 2, [['Paragraphes', 1]])], roleOf)
    expect(groups.map((g) => g.zone.key)).toEqual(['depth-2+'])
  })

  it('suit la typologie en cours : changer un rôle change la signature', () => {
    // La raison d'être du choix « le backend rend des styles, pas des rôles ».
    const runs = [['mention sous titre', 1], ['Paragraphes', 1]]
    const avant = aggregateByDepth([shape('a', 2, runs)], roleOf)
    const apres = aggregateByDepth([shape('a', 2, runs)], (s) => (s === 'mention sous titre' ? 'chapeau' : 'corps'))

    expect(avant[0].signatures[0].label).toBe('définition · corps')
    expect(apres[0].signatures[0].label).toBe('chapeau · corps')
  })
})
