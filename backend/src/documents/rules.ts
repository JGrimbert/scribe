import { StyleRole, STYLE_ROLES } from './typology'

// Ce qu'un nœud doit contenir pour être réputé conforme. Propre à un document,
// comme la typologie sur laquelle ces règles s'appuient.
//
// INDICATIF, pas bloquant : la conformité n'interdit pas de valider un
// chapitre à la main (cf. NodeValidation). C'est un choix dicté par les
// chiffres du manuscrit témoin — exiger définition + tableau des liens y
// rendrait 821 chapitres sur 824 non validables. Une règle qui interdit tout
// le premier jour n'est pas une règle, c'est un mur : elle serait contournée
// ou désactivée, pas suivie.

// Un jeu de critères. C'était tout `DocumentRules` avant qu'ils ne deviennent
// modulables par profondeur.
export interface RuleSet {
  // null = pas de minimum. En caractères hors espaces (même compte que les
  // stats du parseur).
  minChars: number | null
  // Un surlignage typé « annotation » = du travail que l'auteur s'est
  // lui-même signalé.
  forbidAnnotations: boolean
  // Rôles dont au moins un paragraphe doit porter la marque (ex. 'définition').
  requiresRoles: StyleRole[]
  // Le nœud doit porter un tableau. À part des rôles ci-dessus, et ce n'est pas
  // une coquetterie : les paragraphes d'un tableau sont aplatis dans
  // `connexe.tableau` par le parseur et n'apparaissent JAMAIS dans texte[] —
  // un `requiresRoles: ['tableau']` mesurerait toujours 0.
  requiresTable: boolean
}

// Profondeur d'un nœud, plafonnée : 0 = axe, 1 = bloc sémantique, 2 = article
// (« 2 et au-delà »). Même regroupement que les zones de l'inventaire
// (odt-parser/zones.ts, zoneOfDepth) et que les modèles de structure — un
// « Article » doit désigner le même objet partout.
export type DepthKey = 0 | 1 | 2

export const DEPTH_KEYS: DepthKey[] = [0, 1, 2]

export const DEPTH_LABELS: Record<DepthKey, string> = {
  0: 'Axes',
  1: 'Blocs sémantiques',
  2: 'Articles',
}

// Ce qu'on attend d'un axe, d'un bloc et d'un article n'a rien de commun : d'où
// un jeu par profondeur. `default` s'applique à toute profondeur sans jeu
// propre — c'est le cas nominal, et celui de tous les documents existants.
export interface DocumentRules {
  default: RuleSet
  byDepth: Partial<Record<DepthKey, RuleSet>>
}

export function depthKeyOf(depth: number): DepthKey {
  return Math.min(Math.max(depth, 0), 2) as DepthKey
}

// Le jeu qui s'applique à un nœud. Pas d'héritage partiel (un `byDepth` ne
// complète pas `default`, il le remplace) : fusionner deux jeux rendrait
// impossible de RETIRER un critère à une profondeur, et « quelles règles
// s'appliquent ici ? » ne se lirait plus nulle part en entier.
export function rulesFor(rules: DocumentRules, depth: number): RuleSet {
  return rules.byDepth[depthKeyOf(depth)] ?? rules.default
}

export const DEFAULT_RULE_SET: RuleSet = {
  // Les deux seuls critères applicables en l'état du manuscrit témoin : 51 %
  // des chapitres passent le seuil de caractères, 89 % n'ont aucune annotation.
  // Tableau (4,2 %) et définition (0,4 %) restent à activer sciemment.
  minChars: 500,
  forbidAnnotations: true,
  requiresRoles: [],
  requiresTable: false,
}

// `byDepth` vide : sans réglage explicite, le comportement est exactement celui
// d'avant les règles par profondeur — un seul jeu, appliqué aux feuilles.
export const DEFAULT_RULES: DocumentRules = { default: DEFAULT_RULE_SET, byDepth: {} }

// Y a-t-il au moins un jeu spécifique ? Décide si les nœuds non-feuilles sont
// jugés, et si les critères sont étiquetés par niveau (cf. conformity.ts).
export function hasPerDepthRules(rules: DocumentRules): boolean {
  return Object.keys(rules.byDepth).length > 0
}

// Le format historique : les critères à plat, sans `default` ni `byDepth`. Des
// documents en base le portent — ne jamais casser leur lecture.
function isLegacyFlat(body: any): boolean {
  return !!body && typeof body === 'object' && !('default' in body)
}

function normalizeRuleSet(body: Partial<RuleSet> | null | undefined): RuleSet {
  return {
    minChars: body?.minChars ?? null,
    forbidAnnotations: body?.forbidAnnotations ?? false,
    requiresRoles: body?.requiresRoles ?? [],
    requiresTable: body?.requiresTable ?? false,
  }
}

/**
 * Payload (ou colonne en base) → règles exploitables.
 *
 * Trois entrées possibles, trois sorties :
 * - `null` (jamais configuré) → les DÉFAUTS. Rendre des règles toutes vides
 *   déclarerait tout le monde conforme, ce qui est le contraire d'un défaut
 *   utile ;
 * - format historique à plat → remonté en `default`, `byDepth` vide. Un
 *   document déjà configuré ne doit pas perdre ses réglages ;
 * - format courant → normalisé jeu par jeu.
 */
export function normalizeRules(body: unknown | null): DocumentRules {
  // Cloné : DEFAULT_RULES est partagé, le rendre tel quel exposerait les
  // défauts du process à la mutation d'un appelant.
  if (body == null) return { default: { ...DEFAULT_RULE_SET, requiresRoles: [] }, byDepth: {} }

  if (isLegacyFlat(body)) return { default: normalizeRuleSet(body as Partial<RuleSet>), byDepth: {} }

  const input = body as Partial<DocumentRules>
  const byDepth: Partial<Record<DepthKey, RuleSet>> = {}
  for (const [key, set] of Object.entries(input.byDepth ?? {})) {
    const depth = Number(key)
    if (DEPTH_KEYS.includes(depth as DepthKey)) byDepth[depth as DepthKey] = normalizeRuleSet(set)
  }
  return { default: normalizeRuleSet(input.default), byDepth }
}

function ruleSetErrors(body: Partial<RuleSet> | undefined, scope: string): string[] {
  const errors: string[] = []
  if (!body) return errors

  if (body.minChars != null && (!Number.isInteger(body.minChars) || body.minChars < 0)) {
    errors.push(`${scope} : minChars doit être un entier positif, ou null`)
  }
  if (body.requiresRoles && !Array.isArray(body.requiresRoles)) {
    errors.push(`${scope} : requiresRoles doit être une liste de rôles`)
  }
  for (const role of body.requiresRoles ?? []) {
    if (!STYLE_ROLES.includes(role)) errors.push(`${scope} : rôle inconnu « ${role} »`)
  }
  return errors
}

export function rulesErrors(body: unknown): string[] {
  if (body == null) return []
  if (isLegacyFlat(body)) return ruleSetErrors(body as Partial<RuleSet>, 'règles')

  const input = body as Partial<DocumentRules>
  const errors = ruleSetErrors(input.default, 'règles par défaut')

  for (const [key, set] of Object.entries(input.byDepth ?? {})) {
    const depth = Number(key)
    if (!DEPTH_KEYS.includes(depth as DepthKey)) {
      errors.push(`Profondeur inconnue : « ${key} » (attendu 0, 1 ou 2 — 2 valant « 2 et au-delà »)`)
      continue
    }
    errors.push(...ruleSetErrors(set as Partial<RuleSet>, DEPTH_LABELS[depth as DepthKey]))
  }
  return errors
}
