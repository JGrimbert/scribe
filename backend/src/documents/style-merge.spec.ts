import { describe, expect, it } from 'vitest'
import { StyleInventory, TexteEntry } from '../import/odt-parser'
import { DocumentRules } from './rules'
import {
  mergeEntries,
  mergeInventory,
  mergeOverrides,
  mergeRules,
  mergeTypology,
  styleMergeErrors,
} from './style-merge'

const REQ = { keep: 'Definition', drop: 'mention sous titre' }

const usage = (name: string, count: number, extra: Record<string, unknown> = {}) => ({
  name, count, headings: 0, sample: `extrait ${name}`, ...extra,
})

describe('styleMergeErrors', () => {
  it('accepte deux noms distincts', () => {
    expect(styleMergeErrors(REQ)).toEqual([])
  })

  it('refuse un corps vide, un nom manquant ou deux noms identiques', () => {
    expect(styleMergeErrors(null)[0]).toContain('corps attendu')
    expect(styleMergeErrors({ keep: 'A' })[0]).toContain('drop')
    expect(styleMergeErrors({ keep: '  ', drop: 'B' })[0]).toContain('keep')
    expect(styleMergeErrors({ keep: 'A', drop: 'A' })[0]).toContain('même style')
  })
})

describe('mergeInventory', () => {
  const inventory: StyleInventory = {
    styles: [
      usage('Paragraphes', 900),
      usage('mention sous titre', 536, { firstIndex: 4, byZone: { 'depth-2+': 536 } }),
      usage('Definition', 3, { headings: 1, firstIndex: 9, byZone: { 'depth-2+': 2, final: 1 } }),
    ],
    highlights: [],
    visuals: { 'mention sous titre': { italic: true }, Paragraphes: { bold: false } },
  }

  it('additionne les compteurs, garde le nom conservé et retrie par fréquence', () => {
    const out = mergeInventory(inventory, REQ)!
    expect(out.styles.map((s) => s.name)).toEqual(['Paragraphes', 'Definition'])
    const fused = out.styles.find((s) => s.name === 'Definition')!
    expect(fused.count).toBe(539)
    expect(fused.headings).toBe(1)
    expect(fused.firstIndex).toBe(4)
    expect(fused.byZone).toEqual({ 'depth-2+': 538, final: 1 })
  })

  it('hérite de l’apparence du style fondu quand le conservé n’en a pas', () => {
    const out = mergeInventory(inventory, REQ)!
    expect(out.visuals!.Definition).toEqual({ italic: true })
    expect(out.visuals!['mention sous titre']).toBeUndefined()
  })

  it('renomme la ligne quand le style conservé n’est pas dans l’inventaire', () => {
    const out = mergeInventory(inventory, { keep: 'Déclaré à la main', drop: 'Definition' })!
    const renamed = out.styles.find((s) => s.name === 'Déclaré à la main')!
    expect(renamed.count).toBe(3)
    expect(out.styles.some((s) => s.name === 'Definition')).toBe(false)
  })

  it('laisse l’inventaire intact si le style fondu n’y est pas', () => {
    expect(mergeInventory(inventory, { keep: 'A', drop: 'B' })).toBe(inventory)
    expect(mergeInventory(null, REQ)).toBeNull()
  })
})

describe('mergeTypology', () => {
  it('supprime le rôle du style fondu', () => {
    const out = mergeTypology({ styles: { Definition: 'définition', 'mention sous titre': 'chapeau' }, highlights: {} }, REQ)!
    expect(out.styles).toEqual({ Definition: 'définition' })
  })

  it('transmet le rôle quand le style conservé n’en avait pas', () => {
    const out = mergeTypology({ styles: { 'mention sous titre': 'chapeau' }, highlights: {} }, REQ)!
    expect(out.styles).toEqual({ Definition: 'chapeau' })
  })

  it('retire le style déclaré fondu et recolle ceux qui s’ancraient dessus', () => {
    const out = mergeTypology(
      {
        styles: {},
        highlights: {},
        declaredStyles: [
          { name: 'mention sous titre', role: 'chapeau', zoneKey: 'depth-2+', afterName: null },
          { name: 'Autre', role: 'corps', zoneKey: 'depth-2+', afterName: 'mention sous titre' },
        ],
      },
      REQ,
    )!
    expect(out.declaredStyles).toEqual([
      { name: 'Autre', role: 'corps', zoneKey: 'depth-2+', afterName: 'Definition' },
    ])
  })
})

describe('mergeOverrides', () => {
  it('reporte la surcharge du style fondu si le conservé n’en a pas', () => {
    expect(mergeOverrides({ 'mention sous titre': { bold: true } }, REQ)).toEqual({ Definition: { bold: true } })
  })

  it('garde celle du style conservé quand les deux en ont une', () => {
    const out = mergeOverrides({ Definition: { bold: false }, 'mention sous titre': { bold: true } }, REQ)
    expect(out).toEqual({ Definition: { bold: false } })
  })
})

describe('mergeRules', () => {
  const ruleSet = (over: Partial<DocumentRules['default']> = {}) => ({
    minChars: null, forbidAnnotations: false, requiresRoles: [], requiresTable: false,
    requiresStyles: [], requiresAdjacency: [] as [string, string][], ...over,
  })

  it('reporte les styles exigés sans doublon', () => {
    const rules: DocumentRules = {
      default: ruleSet({ requiresStyles: ['Definition', 'mention sous titre', 'Paragraphes'] }),
      byDepth: { 2: ruleSet({ requiresStyles: ['mention sous titre'] }) },
    }
    const out = mergeRules(rules, REQ)!
    expect(out.default.requiresStyles).toEqual(['Definition', 'Paragraphes'])
    expect(out.byDepth[2]!.requiresStyles).toEqual(['Definition'])
  })

  it('reporte les successions et jette la paire dégénérée qu’une fusion produirait', () => {
    const rules: DocumentRules = {
      default: ruleSet({
        requiresAdjacency: [
          ['mention sous titre', 'Paragraphes'],
          ['Definition', 'Paragraphes'], // devient un doublon du précédent
          ['Definition', 'mention sous titre'], // devient « Definition → Definition »
        ],
      }),
      byDepth: {},
    }
    expect(mergeRules(rules, REQ)!.default.requiresAdjacency).toEqual([['Definition', 'Paragraphes']])
  })
})

describe('mergeEntries', () => {
  it('réécrit le style des entrées liminaire/final', () => {
    const entries: TexteEntry[] = [
      { type: 'paragraph', text: 'a', styleName: 'mention sous titre' },
      { type: 'paragraph', text: 'b', styleName: 'Titre' },
    ]
    expect(mergeEntries(entries, REQ)!.map((e) => e.styleName)).toEqual(['Definition', 'Titre'])
    expect(mergeEntries(null, REQ)).toBeNull()
  })
})
