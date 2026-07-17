import { DataMap, HarmonizedItem, TrameNode } from '../import/odt-parser'
import { computeStats } from '../import/odt-parser/text-utils'
import { DocumentTypology } from '../documents/typology'
import { DepthKey, depthKeyOf, DEPTH_LABELS, DocumentRules, hasPerDepthRules, RuleSet, rulesFor } from '../documents/rules'
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
  // Nombre de nœuds JUGÉS — pas forcément des feuilles depuis que les règles
  // sont modulables par profondeur (cf. judgedNodes). Sans jeu par profondeur,
  // ce sont exactement les feuilles, comme avant.
  judgedCount: number
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

function buildCriteria(rules: RuleSet, typology: DocumentTypology): Criterion[] {
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

/**
 * Les nœuds à juger, dans l'ordre du document.
 *
 * Les FEUILLES d'abord — un conteneur n'a pas à porter une définition, ce sont
 * ses chapitres qui l'ont. Mais si l'utilisateur a posé un jeu de règles
 * explicite pour une profondeur, il a précisément décrété le contraire pour
 * elle : ses nœuds sont alors jugés, feuilles ou non. Sans jeu par profondeur,
 * on juge exactement les feuilles, comme avant ce lot.
 */
function judgedNodes(
  trame: AxesTree,
  data: DataMap,
  rules: DocumentRules,
): { nodeId: string; item: HarmonizedItem; depth: number }[] {
  const perDepth = hasPerDepthRules(rules)
  const out: { nodeId: string; item: HarmonizedItem; depth: number }[] = []

  const walk = (node: TrameNode, depth: number) => {
    const item = data[node.id]
    const isLeaf = node.children.length === 0
    const claimed = perDepth && rules.byDepth[depthKeyOf(depth)] != null
    if (item && (isLeaf || claimed)) out.push({ nodeId: node.id, item, depth })
    node.children.forEach((child) => walk(child, depth + 1))
  }

  trame.axes.forEach((axe) => walk(axe, 0))
  return out
}

export function assessConformity(
  trame: AxesTree,
  data: DataMap,
  typology: DocumentTypology | null,
  rules: DocumentRules,
): ConformityAnalysis {
  const nodes = judgedNodes(trame, data, rules)

  if (!typology) {
    return { available: false, rules, judgedCount: nodes.length, conformCount: 0, criteria: [], failures: [] }
  }

  // Un jeu de critères par PROFONDEUR RÉELLEMENT JUGÉE — pas un par profondeur
  // possible : sans réglage, un seul jeu sert tout le monde et le graphe du
  // dashboard garde exactement ses barres d'avant.
  const perDepth = hasPerDepthRules(rules)
  const criteriaByDepth = new Map<DepthKey, Criterion[]>()
  const criteria: ConformityCriterion[] = []
  const failingByKey = new Map<string, number>()

  for (const { depth } of nodes) {
    const key = depthKeyOf(depth)
    if (criteriaByDepth.has(key)) continue

    // Préfixée par la profondeur : sans ça, « au moins 500 caractères » à deux
    // niveaux se confondrait en une seule barre, et le compte d'échecs
    // mélangerait des axes et des articles.
    const scoped = buildCriteria(rulesFor(rules, depth), typology).map((c) => ({
      ...c,
      key: perDepth ? `${key}|${c.key}` : c.key,
      // Le frontend affiche ce label tel quel (cf. ConformityChart) : c'est ici
      // qu'il doit devenir auto-explicite, pas là-bas.
      label: perDepth ? `${DEPTH_LABELS[key]} — ${c.label}` : c.label,
    }))
    criteriaByDepth.set(key, scoped)
    for (const c of scoped) {
      criteria.push({ key: c.key, label: c.label, failing: 0 })
      failingByKey.set(c.key, 0)
    }
  }

  const failures: ConformityFailure[] = []

  for (const { nodeId, item, depth } of nodes) {
    const applicable = criteriaByDepth.get(depthKeyOf(depth)) ?? []
    const failed = applicable.filter((c) => !c.test(item)).map((c) => c.key)
    for (const key of failed) failingByKey.set(key, (failingByKey.get(key) ?? 0) + 1)
    if (failed.length) failures.push({ nodeId, titre: item.titre, failed })
  }

  return {
    available: true,
    rules,
    judgedCount: nodes.length,
    conformCount: nodes.length - failures.length,
    criteria: criteria.map((c) => ({ ...c, failing: failingByKey.get(c.key)! })),
    failures,
  }
}
