import { describe, expect, it } from 'vitest'
import { ExistingNode, PreviousValidation, RebuiltNode, remapNodeIds, remapValidations } from './recalibration'

const AT = new Date('2026-07-01T10:00:00.000Z')

function previous(slug: string, currentHash: string, storedHash = currentHash): PreviousValidation {
  return { slug, currentHash, storedHash, validatedAt: AT }
}

function rebuilt(nodeId: string, slug: string, currentHash: string): RebuiltNode {
  return { nodeId, slug, currentHash }
}

describe('remapValidations', () => {
  it('repose la validation sur le nœud reconstruit de même slug et même texte', () => {
    const result = remapValidations([previous('la-lisiere', 'hash-a')], [rebuilt('neuf-1', 'la-lisiere', 'hash-a')])

    expect(result.dropped).toEqual([])
    expect(result.restore).toEqual([{ nodeId: 'neuf-1', contentHash: 'hash-a', validatedAt: AT }])
  })

  it("repose le hash STOCKÉ et non le courant — un chapitre périmé le reste", () => {
    // Le nœud a été relu quand son texte valait `hash-vieux` ; il vaut
    // `hash-neuf` aujourd'hui. Reposer `hash-neuf` le déclarerait relu alors
    // qu'il ne l'a pas été depuis la modification.
    const result = remapValidations(
      [previous('article', 'hash-neuf', 'hash-vieux')],
      [rebuilt('neuf-1', 'article', 'hash-neuf')],
    )

    expect(result.restore).toEqual([{ nodeId: 'neuf-1', contentHash: 'hash-vieux', validatedAt: AT }])
  })

  it('identifie le nœud même si son parent a changé — le cas que la recalibration sert', () => {
    // Aucune notion de chemin : le nœud est reconnu par (slug, texte), qu'il
    // soit devenu axe, bloc ou article.
    const result = remapValidations([previous('octogramme', 'hash-x')], [rebuilt('promu', 'octogramme', 'hash-x')])

    expect(result.restore).toHaveLength(1)
    expect(result.restore[0].nodeId).toBe('promu')
  })

  it('laisse tomber une validation dont le nœud a disparu (borne déplacée en liminaire)', () => {
    const result = remapValidations([previous('dedicace', 'hash-d')], [rebuilt('autre', 'la-lisiere', 'hash-a')])

    expect(result.restore).toEqual([])
    expect(result.dropped).toEqual([{ slug: 'dedicace', reason: 'disparu' }])
  })

  it("ne repose rien quand deux nœuds reconstruits sont indiscernables — 228 articles vides sur le témoin", () => {
    const vide = ''
    const result = remapValidations(
      [previous('notes', vide)],
      [rebuilt('neuf-1', 'notes', vide), rebuilt('neuf-2', 'notes', vide)],
    )

    expect(result.restore).toEqual([])
    expect(result.dropped).toEqual([{ slug: 'notes', reason: 'ambigu' }])
  })

  it('ne repose rien quand deux validations de départ sont indiscernables', () => {
    // Deux « Notes » vides validés sous deux parents : même après
    // reconstruction, rien ne dit laquelle des deux va où.
    const result = remapValidations(
      [previous('notes', ''), previous('notes', '')],
      [rebuilt('neuf-1', 'notes', '')],
    )

    expect(result.restore).toEqual([])
    expect(result.dropped).toEqual([
      { slug: 'notes', reason: 'ambigu' },
      { slug: 'notes', reason: 'ambigu' },
    ])
  })

  it('reste discriminant quand le slug se répète mais que les textes diffèrent', () => {
    const result = remapValidations(
      [previous('notes', 'hash-a'), previous('notes', 'hash-b')],
      [rebuilt('neuf-a', 'notes', 'hash-a'), rebuilt('neuf-b', 'notes', 'hash-b')],
    )

    expect(result.dropped).toEqual([])
    expect(result.restore.map((r) => r.nodeId).sort()).toEqual(['neuf-a', 'neuf-b'])
  })

  it('reste discriminant quand le texte se répète mais que les slugs diffèrent', () => {
    const result = remapValidations(
      [previous('avant', ''), previous('apres', '')],
      [rebuilt('neuf-1', 'avant', ''), rebuilt('neuf-2', 'apres', '')],
    )

    expect(result.dropped).toEqual([])
    expect(result.restore).toHaveLength(2)
  })

  it('neutralise une clé même à trois occurrences', () => {
    // Garde-fou sur `uniqueByKey` : retirer la clé au lieu de la neutraliser
    // ferait réapparaître le troisième homonyme comme unique.
    const result = remapValidations(
      [previous('notes', '')],
      [rebuilt('a', 'notes', ''), rebuilt('b', 'notes', ''), rebuilt('c', 'notes', '')],
    )

    expect(result.restore).toEqual([])
    expect(result.dropped).toEqual([{ slug: 'notes', reason: 'ambigu' }])
  })

  it("ne confond pas deux couples que la concaténation rendrait identiques", () => {
    // Sans séparateur, ('a', 'b-c') et ('a-b', 'c') donneraient la même clé.
    const result = remapValidations([previous('a', 'b-c')], [rebuilt('neuf', 'a-b', 'c')])

    expect(result.restore).toEqual([])
    expect(result.dropped).toEqual([{ slug: 'a', reason: 'disparu' }])
  })

  it('ne fait rien sur un document sans aucune validation', () => {
    expect(remapValidations([], [rebuilt('neuf', 'la-lisiere', 'hash-a')])).toEqual({ restore: [], dropped: [] })
  })
})

function existing(nodeId: string, slug: string, currentHash: string): ExistingNode {
  return { nodeId, slug, currentHash }
}

describe('remapNodeIds', () => {
  it("réattribue l'id existant au nœud reconstruit de même slug et même texte", () => {
    const r = remapNodeIds([existing('vieux-1', 'la-lisiere', 'h-a')], [rebuilt('neuf-1', 'la-lisiere', 'h-a')])

    expect(r.reuse.get('neuf-1')).toBe('vieux-1')
    expect(r.fresh).toBe(0)
    expect(r.orphaned).toBe(0)
  })

  it('laisse son id neuf à un nœud qui n’existait pas', () => {
    const r = remapNodeIds([], [rebuilt('neuf-1', 'inedit', 'h-x')])

    expect(r.reuse.size).toBe(0)
    expect(r.fresh).toBe(1)
    expect(r.orphaned).toBe(0)
  })

  it('compte comme orphelin un nœud existant qu’on ne retrouve pas — ses analyses pointent dans le vide', () => {
    const r = remapNodeIds([existing('vieux-1', 'disparu', 'h-a')], [rebuilt('neuf-1', 'autre', 'h-b')])

    expect(r.reuse.size).toBe(0)
    expect(r.orphaned).toBe(1)
  })

  it('n’apparie RIEN quand le couple est ambigu — 257 chapitres vides partagent le hash du vide', () => {
    const r = remapNodeIds(
      [existing('v-1', 'notes', 'vide'), existing('v-2', 'notes', 'vide')],
      [rebuilt('n-1', 'notes', 'vide'), rebuilt('n-2', 'notes', 'vide')],
    )

    expect(r.reuse.size).toBe(0)
    expect(r.fresh).toBe(2)
    expect(r.orphaned).toBe(2)
  })

  it('INVARIANT : un id existant n’est jamais réutilisé deux fois (collision de clé primaire)', () => {
    // Deux nœuds reconstruits identiques face à un seul ancien : les apparier
    // tous les deux dupliquerait la clé primaire.
    const r = remapNodeIds(
      [existing('v-1', 'notes', 'vide')],
      [rebuilt('n-1', 'notes', 'vide'), rebuilt('n-2', 'notes', 'vide')],
    )

    const reused = [...r.reuse.values()]
    expect(new Set(reused).size).toBe(reused.length)
    expect(r.reuse.size).toBe(0)
  })

  it('apparie chapitre par chapitre sur un lot mêlant conservés, nouveaux et disparus', () => {
    const r = remapNodeIds(
      [existing('v-1', 'a', 'h-a'), existing('v-2', 'b', 'h-b'), existing('v-3', 'parti', 'h-c')],
      [rebuilt('n-1', 'a', 'h-a'), rebuilt('n-2', 'b', 'h-b'), rebuilt('n-3', 'neuf', 'h-d')],
    )

    expect(r.reuse.get('n-1')).toBe('v-1')
    expect(r.reuse.get('n-2')).toBe('v-2')
    expect(r.reuse.has('n-3')).toBe(false)
    expect(r.fresh).toBe(1)
    expect(r.orphaned).toBe(1)
  })
})
