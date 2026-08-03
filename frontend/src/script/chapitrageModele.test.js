import { describe, it, expect } from 'vitest'
import { modelStyleNames, splitByModel } from './chapitrageModele'

const shape = (runs) => ({ nodeId: 'n1', titre: 'Le Blaireau', depth: 2, isLeaf: true, runs, chars: 9999 })
const style = (name) => ({ name, headings: 0, sample: '', count: 1 })

describe('modelStyleNames', () => {
  it('préfixe le style du titre, qui n\'est pas une entrée de texte', () => {
    const s = shape([['Paragraphes', 4], ['Citation', 1]])
    expect(modelStyleNames(s, 'Heading 3')).toEqual(['Heading 3', 'Paragraphes', 'Citation'])
  })

  it('dédoublonne en gardant la PREMIÈRE place', () => {
    const s = shape([['Paragraphes', 2], ['Citation', 1], ['Paragraphes', 3]])
    expect(modelStyleNames(s)).toEqual(['Paragraphes', 'Citation'])
  })

  it('écarte les paragraphes sans style (documents d\'avant leur relevé)', () => {
    expect(modelStyleNames(shape([['', 3], ['Paragraphes', 1]]), null)).toEqual(['Paragraphes'])
  })

  it('rend une liste vide sans forme', () => {
    expect(modelStyleNames(null)).toEqual([])
    expect(modelStyleNames(null, 'Heading 3')).toEqual(['Heading 3'])
  })
})

describe('splitByModel', () => {
  const styles = [style('Heading 3'), style('Paragraphes'), style('Voir'), style('Citation')]

  it('range le modèle dans SON ordre et le reste dans celui de l\'inventaire', () => {
    const { model, others } = splitByModel(styles, ['Heading 3', 'Citation', 'Paragraphes'])
    expect(model.map((s) => s.name)).toEqual(['Heading 3', 'Citation', 'Paragraphes'])
    expect(others.map((s) => s.name)).toEqual(['Voir'])
  })

  it('garde un style du modèle absent de l\'inventaire de la zone', () => {
    // Style à cheval : sa zone dominante est ailleurs, mais le nœud inspecté le
    // porte — l'escamoter ferait mentir le tableau.
    const { model, others } = splitByModel(styles, ['Paragraphes', 'Dédicace'])
    expect(model.map((s) => s.name)).toEqual(['Paragraphes', 'Dédicace'])
    expect(others.map((s) => s.name)).toEqual(['Heading 3', 'Voir', 'Citation'])
  })

  it('sans modèle, tout tombe dans les autres styles', () => {
    const { model, others } = splitByModel(styles, [])
    expect(model).toEqual([])
    expect(others).toHaveLength(4)
  })

  it('tolère des entrées nulles', () => {
    expect(splitByModel(null, null)).toEqual({ model: [], others: [] })
  })
})
