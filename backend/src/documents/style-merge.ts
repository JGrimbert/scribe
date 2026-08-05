// Fusion de deux styles : `drop` disparaît du document, ses paragraphes passent
// sous `keep`. Opération DESTRUCTIVE et sans mémoire — le nom fondu n'existe
// plus nulle part, et rien ne dit qu'il a existé (choix utilisateur explicite).
//
// ⚠️ Une recalibration reparse le `.odt`, qui lui n'a pas bougé : elle ramène les
// deux styles d'origine et la fusion est à refaire. Même famille de piège que
// l'écrasement du contenu signalé dans le CLAUDE.md du module.
//
// Ce fichier ne porte que la logique PURE (les métadonnées Json de `Document`) ;
// les deux tables (`Paragraph.styleName`, `Node.styleName`) sont réécrites par le
// service, en transaction avec elles.

import { StyleInventory, StyleUsage, TexteEntry, ZoneCounts } from '../import/odt-parser'
import { DocumentRules, RuleSet } from './rules'
import { DocumentTypology } from './typology'
import { StyleOverrides } from './style-overrides'

export interface StyleMergeRequest {
  keep: string
  drop: string
}

// Ce que la fusion a réellement réécrit — le client l'annonce, et c'est la seule
// trace qu'il en restera (l'opération n'est pas mémorisée).
export interface StyleMergeResponse extends StyleMergeRequest {
  paragraphs: number
  nodes: number
}

// Vide = requête valide. Un style peut être absent de l'inventaire (style
// déclaré à la main) : on ne l'exige donc pas, seuls les deux noms comptent.
export function styleMergeErrors(body: unknown): string[] {
  const errors: string[] = []
  if (typeof body !== 'object' || body === null) return ['corps attendu : { keep, drop }']
  const { keep, drop } = body as Record<string, unknown>
  if (typeof keep !== 'string' || !keep.trim()) errors.push('keep : nom de style attendu')
  if (typeof drop !== 'string' || !drop.trim()) errors.push('drop : nom de style attendu')
  if (typeof keep === 'string' && typeof drop === 'string' && keep === drop) {
    errors.push('keep et drop désignent le même style')
  }
  return errors
}

const addZones = (a?: ZoneCounts, b?: ZoneCounts): ZoneCounts | undefined => {
  if (!a) return b
  if (!b) return a
  const out: ZoneCounts = { ...a }
  for (const [zone, n] of Object.entries(b)) {
    out[zone as keyof ZoneCounts] = (out[zone as keyof ZoneCounts] ?? 0) + (n ?? 0)
  }
  return out
}

// Les deux relevés n'en font plus qu'un : les compteurs s'additionnent, la
// première apparition est la plus précoce des deux, et l'échantillon de `keep`
// est conservé (c'est lui qu'on garde, son extrait doit rester reconnaissable).
function fuseUsage(keep: StyleUsage, drop: StyleUsage): StyleUsage {
  return {
    ...keep,
    count: keep.count + drop.count,
    headings: keep.headings + drop.headings,
    sample: keep.sample || drop.sample,
    firstIndex: Math.min(keep.firstIndex ?? Infinity, drop.firstIndex ?? Infinity) || undefined,
    byZone: addZones(keep.byZone, drop.byZone),
  }
}

/**
 * L'inventaire après fusion : une seule ligne, l'apparence de `keep` si elle
 * existe (sinon celle de `drop` — le rendu ne doit pas se dégrader), et le tri
 * par fréquence décroissante rétabli.
 */
export function mergeInventory(
  inventory: StyleInventory | null,
  { keep, drop }: StyleMergeRequest,
): StyleInventory | null {
  if (!inventory) return inventory
  const dropped = inventory.styles.find((s) => s.name === drop)
  if (!dropped) return inventory

  const kept = inventory.styles.find((s) => s.name === keep)
  const fused = kept ? fuseUsage(kept, dropped) : { ...dropped, name: keep }
  const styles = inventory.styles
    .filter((s) => s.name !== drop && s.name !== keep)
    .concat(fused)
    .sort((a, b) => b.count - a.count)

  const out: StyleInventory = { ...inventory, styles }
  if (inventory.visuals) {
    const visuals = { ...inventory.visuals }
    if (!visuals[keep] && visuals[drop]) visuals[keep] = visuals[drop]
    delete visuals[drop]
    out.visuals = visuals
  }
  return out
}

// Le rôle arbitré pour `drop` ne se perd que si `keep` en a déjà un : sinon il
// lui revient (l'utilisateur a tranché une fois, la fusion ne le lui redemande
// pas). Idem pour la place d'un style déclaré.
export function mergeTypology(
  typology: DocumentTypology | null,
  { keep, drop }: StyleMergeRequest,
): DocumentTypology | null {
  if (!typology) return typology
  const styles = { ...typology.styles }
  if (styles[drop] && !styles[keep]) styles[keep] = styles[drop]
  delete styles[drop]

  const out: DocumentTypology = { ...typology, styles }
  if (typology.declaredStyles) {
    out.declaredStyles = typology.declaredStyles
      .filter((s) => s.name !== drop)
      .map((s) => (s.afterName === drop ? { ...s, afterName: keep } : s))
  }
  // « Ce qui précède » suit la même règle que le rôle : revient à `keep` s'il n'en
  // avait pas, sinon le sien tient. Sans ça, la clé `drop` survivrait, orpheline.
  if (typology.stylePrecedence) {
    const precedence = { ...typology.stylePrecedence }
    if (precedence[drop] && !precedence[keep]) precedence[keep] = precedence[drop]
    delete precedence[drop]
    out.stylePrecedence = precedence
  }
  return out
}

export function mergeOverrides(
  overrides: StyleOverrides | null,
  { keep, drop }: StyleMergeRequest,
): StyleOverrides | null {
  if (!overrides || !overrides[drop]) return overrides
  const out = { ...overrides }
  if (!out[keep]) out[keep] = out[drop]
  delete out[drop]
  return out
}

// Une règle qui visait le style fondu vise désormais celui qui reste — sans
// doublon, et sans paire dégénérée (« A toujours suivi de A » n'a de sens que si
// l'utilisateur l'a demandé, pas comme résidu d'une fusion).
function mergeRuleSet(rules: RuleSet, { keep, drop }: StyleMergeRequest): RuleSet {
  const requiresStyles = [...new Set(rules.requiresStyles.map((s) => (s === drop ? keep : s)))]
  const pairs = rules.requiresAdjacency
    .map(([a, b]) => [a === drop ? keep : a, b === drop ? keep : b] as [string, string])
    .filter(([a, b], i, all) => a !== b && all.findIndex(([x, y]) => x === a && y === b) === i)
  return { ...rules, requiresStyles, requiresAdjacency: pairs }
}

export function mergeRules(rules: DocumentRules | null, req: StyleMergeRequest): DocumentRules | null {
  if (!rules) return rules
  const byDepth: DocumentRules['byDepth'] = {}
  for (const [depth, set] of Object.entries(rules.byDepth)) {
    if (set) byDepth[depth as unknown as keyof DocumentRules['byDepth']] = mergeRuleSet(set, req)
  }
  return { default: mergeRuleSet(rules.default, req), byDepth }
}

// Liminaire et final ne sont pas des nœuds (colonnes Json, cf. schema.prisma) :
// leurs entrées portent leur propre styleName, à réécrire ici.
export function mergeEntries(entries: TexteEntry[] | null, { keep, drop }: StyleMergeRequest): TexteEntry[] | null {
  if (!entries) return entries
  return entries.map((entry) => (entry.styleName === drop ? { ...entry, styleName: keep } : entry))
}
