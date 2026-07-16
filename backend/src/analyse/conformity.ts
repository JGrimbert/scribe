import { DataMap, HarmonizedItem, TrameNode } from '../import/odt-parser'
import { computeStats } from '../import/odt-parser/text-utils'
import { DocumentTypology } from '../documents/typology'
import { DocumentRules } from '../documents/rules'
import { plainNodeText } from './plain-text'

// Conformité d'un chapitre aux règles du document : ce qui lui manque pour
// être réputé prêt. Même nature que `completeness` — dérivé du seul contenu,
// calculé à la volée au GET, jamais persisté (rien à cacher : c'est deux
// parcours de tableau).
//
// Ne juge que les FEUILLES, comme completeness : un conteneur (axe, partie)
// n'a pas à porter une définition ou un tableau, c'est à ses chapitres de le
// faire.
//
// INDICATIF : rien ici ne bloque la validation manuelle d'un chapitre (cf.
// rules.ts pour le pourquoi).

type AxesTree = { axes: TrameNode[] }

const INLINE_MARK_RE = /<mark data-hl="([^"]+)">/g

export interface ConformityCriterion {
  key: string
  label: string
  failing: number // chapitres qui échouent à ce seul critère — une barre du graphe
}

export interface ConformityFailure {
  nodeId: string
  titre: string
  failed: string[] // clés des critères non satisfaits
}

export interface ConformityAnalysis {
  // false = typologie pas encore arbitrée : sans elle, « contient une
  // définition » ou « sans annotation » n'ont pas de sens. Le frontend renvoie
  // alors vers l'écran de configuration plutôt que d'afficher un verdict qui
  // ne reposerait sur rien.
  available: boolean
  rules: DocumentRules
  leafCount: number
  conformCount: number
  criteria: ConformityCriterion[]
  failures: ConformityFailure[] // dans l'ordre du document
}

interface Criterion {
  key: string
  label: string
  test: (item: HarmonizedItem) => boolean
}

// Couleurs de surlignage typées « annotation » : du travail que l'auteur s'est
// signalé à lui-même.
function annotationColors(typology: DocumentTypology): Set<string> {
  return new Set(
    Object.entries(typology.highlights)
      .filter(([, role]) => role === 'annotation')
      .map(([color]) => color),
  )
}

function hasAnnotation(item: HarmonizedItem, colors: Set<string>): boolean {
  return item.texte.some((entry) => {
    if (entry.highlight && colors.has(entry.highlight)) return true
    // Les surlignages inline ne survivent que dans le texte, en marqueurs :
    // plainNodeText les effacerait, il faut donc lire le texte brut.
    const text = entry.type === 'paragraph' ? entry.text : ''
    return [...text.matchAll(INLINE_MARK_RE)].some(([, color]) => colors.has(color))
  })
}

function hasRole(item: HarmonizedItem, typology: DocumentTypology, role: string): boolean {
  return item.texte.some((entry) => entry.styleName && typology.styles[entry.styleName] === role)
}

function buildCriteria(rules: DocumentRules, typology: DocumentTypology): Criterion[] {
  const criteria: Criterion[] = []

  if (rules.minChars != null) {
    criteria.push({
      key: 'minChars',
      label: `au moins ${rules.minChars} caractères`,
      test: (item) => computeStats(plainNodeText(item.texte)).caracteres >= rules.minChars!,
    })
  }

  if (rules.forbidAnnotations) {
    const colors = annotationColors(typology)
    criteria.push({
      key: 'annotations',
      label: 'aucune annotation en attente',
      test: (item) => !hasAnnotation(item, colors),
    })
  }

  if (rules.requiresTable) {
    criteria.push({
      key: 'table',
      // Le tableau ne se cherche PAS dans texte[] : le parseur l'aplatit dans
      // connexe.tableau, ses paragraphes n'existent nulle part ailleurs.
      label: 'un tableau',
      test: (item) => !!item.connexe?.tableau?.length,
    })
  }

  for (const role of rules.requiresRoles) {
    criteria.push({
      key: `role:${role}`,
      label: `un paragraphe « ${role} »`,
      test: (item) => hasRole(item, typology, role),
    })
  }

  return criteria
}

function leavesOf(trame: AxesTree, data: DataMap): { nodeId: string; item: HarmonizedItem }[] {
  const out: { nodeId: string; item: HarmonizedItem }[] = []
  const walk = (node: TrameNode) => {
    const item = data[node.id]
    if (item && node.children.length === 0) out.push({ nodeId: node.id, item })
    node.children.forEach(walk)
  }
  trame.axes.forEach(walk)
  return out
}

export function assessConformity(
  trame: AxesTree,
  data: DataMap,
  typology: DocumentTypology | null,
  rules: DocumentRules,
): ConformityAnalysis {
  const leaves = leavesOf(trame, data)

  if (!typology) {
    return { available: false, rules, leafCount: leaves.length, conformCount: 0, criteria: [], failures: [] }
  }

  const criteria = buildCriteria(rules, typology)
  const failures: ConformityFailure[] = []
  const failingByKey = new Map(criteria.map((c) => [c.key, 0]))

  for (const { nodeId, item } of leaves) {
    const failed = criteria.filter((c) => !c.test(item)).map((c) => c.key)
    for (const key of failed) failingByKey.set(key, failingByKey.get(key)! + 1)
    if (failed.length) failures.push({ nodeId, titre: item.titre, failed })
  }

  return {
    available: true,
    rules,
    leafCount: leaves.length,
    conformCount: leaves.length - failures.length,
    criteria: criteria.map((c) => ({ key: c.key, label: c.label, failing: failingByKey.get(c.key)! })),
    failures,
  }
}
