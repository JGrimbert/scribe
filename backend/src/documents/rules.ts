import { StyleRole, STYLE_ROLES } from './typology'

// Ce qu'un chapitre doit contenir pour être réputé conforme. Propre à un
// document, comme la typologie sur laquelle ces règles s'appuient.
//
// INDICATIF, pas bloquant : la conformité n'interdit pas de valider un
// chapitre à la main (cf. NodeValidation). C'est un choix dicté par les
// chiffres du manuscrit témoin — exiger définition + tableau des liens y
// rendrait 821 chapitres sur 824 non validables. Une règle qui interdit tout
// le premier jour n'est pas une règle, c'est un mur : elle serait contournée
// ou désactivée, pas suivie.

export interface DocumentRules {
  // null = pas de minimum. En caractères hors espaces (même compte que les
  // stats du parseur).
  minChars: number | null
  // Un surlignage typé « annotation » = du travail que l'auteur s'est
  // lui-même signalé.
  forbidAnnotations: boolean
  // Rôles dont au moins un paragraphe doit porter la marque (ex. 'définition').
  requiresRoles: StyleRole[]
  // Le chapitre doit porter un tableau. À part des rôles ci-dessus, et ce
  // n'est pas une coquetterie : les paragraphes d'un tableau sont aplatis
  // dans `connexe.tableau` par le parseur et n'apparaissent JAMAIS dans
  // texte[] — un `requiresRoles: ['tableau']` mesurerait toujours 0.
  requiresTable: boolean
}

// Les deux seuls critères applicables en l'état du manuscrit témoin : 51 % des
// chapitres passent le seuil de caractères, 89 % n'ont aucune annotation.
// Tableau (4,2 %) et définition (0,4 %) restent à activer sciemment.
export const DEFAULT_RULES: DocumentRules = {
  minChars: 500,
  forbidAnnotations: true,
  requiresRoles: [],
  requiresTable: false,
}

export function rulesErrors(body: Partial<DocumentRules>): string[] {
  const errors: string[] = []
  if (body.minChars != null && (!Number.isInteger(body.minChars) || body.minChars < 0)) {
    errors.push('minChars doit être un entier positif, ou null')
  }
  if (body.requiresRoles && !Array.isArray(body.requiresRoles)) {
    errors.push('requiresRoles doit être une liste de rôles')
  }
  for (const role of body.requiresRoles ?? []) {
    if (!STYLE_ROLES.includes(role)) errors.push(`Rôle inconnu : « ${role} »`)
  }
  return errors
}

export function normalizeRules(body: Partial<DocumentRules> | null): DocumentRules {
  return {
    minChars: body?.minChars ?? null,
    forbidAnnotations: body?.forbidAnnotations ?? false,
    requiresRoles: body?.requiresRoles ?? [],
    requiresTable: body?.requiresTable ?? false,
  }
}
