import { describe, it, expect } from 'vitest'
import { aggregateByDepth, coarseSignature, isWritten, toRoleRuns } from './shapes'

const shape = (nodeId, depth, runs, { titre = nodeId, chars = 9999 } = {}) => ({
  nodeId,
  titre,
  depth,
  isLeaf: true,
  runs,
  chars,
  highlights: [],
})

// Typologie de test : deux styles distincts partagent « corps » ; « SousTitre »
// est un sous-titre mal typé en « titre » (le cas chauve-souris).
const roles = {
  Paragraphes: 'corps',
  'Text body': 'corps',
  SousTitre: 'titre',
  'mention sous titre': 'définition',
  Citation: 'citation',
  Ornement: 'ornement',
  Voir: 'renvoi',
}
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

describe('isWritten', () => {
  it('un nœud sans rôle substantiel (titre/ornement seuls, ou rien) n’est pas rédigé', () => {
    expect(isWritten([])).toBe(false)
    expect(isWritten([['titre', 1]])).toBe(false)
    expect(isWritten([['ornement', 1]])).toBe(false)
    expect(isWritten([['titre', 1], ['ornement', 1]])).toBe(false)
  })

  it('un corps suffit à rendre un nœud rédigé', () => {
    expect(isWritten([['corps', 1]])).toBe(true)
    expect(isWritten([['titre', 1], ['définition', 1]])).toBe(true)
  })
})

describe('coarseSignature', () => {
  it('préfixe toujours un titre : le heading n’est jamais dans le corps', () => {
    expect(coarseSignature([['définition', 1], ['corps', 2]])).toEqual(['titre', 'définition'])
  })

  it('un article pur (corps seul) garde un corps, pour ne pas se confondre avec un squelette', () => {
    expect(coarseSignature([['corps', 3]])).toEqual(['titre', 'corps'])
  })

  it('ne renomme pas un second titre : un titre venu du corps disparaît', () => {
    // « La chauve-souris » : un sous-titre mal typé en titre. Elle converge alors
    // vers la même forme que « le blaireau » (titre · définition).
    expect(coarseSignature([['titre', 1], ['définition', 1], ['corps', 2]])).toEqual(['titre', 'définition'])
  })

  it('retire le corps de remplissage et dédoublonne les rôles consécutifs', () => {
    // Deux formes qui ne diffèrent que par un cycle « citation · corps » répété
    // se rejoignent.
    const a = coarseSignature([['titre', 1], ['corps', 1], ['citation', 1], ['corps', 1], ['citation', 1], ['corps', 1]])
    const b = coarseSignature([['titre', 1], ['corps', 1], ['citation', 1], ['corps', 1]])
    expect(a).toEqual(['titre', 'citation'])
    expect(b).toEqual(['titre', 'citation'])
  })

  it('un corps final ne scinde pas deux formes identiques', () => {
    const a = coarseSignature([['corps', 1], ['ornement', 1]])
    const b = coarseSignature([['corps', 1], ['ornement', 1], ['corps', 1]])
    expect(a).toEqual(['titre', 'ornement'])
    expect(b).toEqual(['titre', 'ornement'])
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

  it('rassemble les nœuds de même signature grossie', () => {
    // Le blaireau et la chauve-souris (sous-titre mal typé) convergent.
    const blaireau = [['mention sous titre', 1], ['Paragraphes', 2]]
    const chauveSouris = [['SousTitre', 1], ['mention sous titre', 1], ['Paragraphes', 2]]
    const groups = aggregateByDepth(
      [shape('a', 2, blaireau), shape('b', 2, chauveSouris), shape('c', 2, [['Paragraphes', 1]])],
      roleOf,
    )

    const [dominant, autre] = groups[0].signatures
    expect(dominant).toMatchObject({ label: 'titre · définition', count: 2, pct: 67 })
    expect(autre).toMatchObject({ label: 'titre · corps', count: 1 })
    expect(dominant.nodes.map((n) => n.nodeId)).toEqual(['a', 'b'])
  })

  it('compte les nœuds non rédigés à part et ne les propose jamais comme modèle', () => {
    // Squelettes : rien, ou un titre seul, ou un filet. « vide » est la forme la
    // plus fréquente à tous les niveaux (228/818 sur le témoin) ; en faire un
    // modèle reviendrait à proposer « un chapitre ne doit rien contenir ».
    const groups = aggregateByDepth(
      [
        shape('a', 2, []),
        shape('b', 2, [['SousTitre', 1]]),
        shape('o', 2, [['Ornement', 1]]),
        shape('c', 2, [['Paragraphes', 1]]),
      ],
      roleOf,
    )

    expect(groups[0]).toMatchObject({ total: 4, empty: 3 })
    expect(groups[0].signatures.map((s) => s.label)).toEqual(['titre · corps'])
  })

  it('rapporte les pourcentages aux nœuds ÉCRITS, pas au total', () => {
    // 1 seul nœud écrit sur 3 → sa forme régit 100 % de ce qui est rédigé.
    const groups = aggregateByDepth([shape('a', 2, []), shape('b', 2, []), shape('c', 2, [['Paragraphes', 1]])], roleOf)
    expect(groups[0].signatures[0].pct).toBe(100)
  })

  it('écarte des modèles les nœuds sous le seuil « au moins N caractères » du niveau', () => {
    const minCharsOf = (zoneKey) => (zoneKey === 'depth-2+' ? 500 : null)
    const groups = aggregateByDepth(
      [
        shape('court', 2, [['Paragraphes', 1]], { chars: 100 }),
        shape('long', 2, [['Paragraphes', 1]], { chars: 600 }),
      ],
      roleOf,
      minCharsOf,
    )
    // Le court rejoint les non rédigés, seul le long définit un modèle.
    expect(groups[0]).toMatchObject({ total: 2, empty: 1 })
    expect(groups[0].signatures[0]).toMatchObject({ label: 'titre · corps', count: 1 })
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
      ['titre · corps', 3],
      ['titre · renvoi', 1],
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

    expect(avant[0].signatures[0].label).toBe('titre · définition')
    expect(apres[0].signatures[0].label).toBe('titre · chapeau')
  })
})
