// Réglages typographiques GÉNÉRAUX décidés par l'utilisateur, appliqués par-dessus
// les styles du .odt. Persistés à part (colonne `styleDefaults`), séparés de
// `styleInventory` (un relevé d'import) : ce sont des DÉCISIONS, même nature que
// `liminaireConfig`.
//
// Première propriété : la CÉSURE. `hyphenation.global` est le défaut le moins
// spécifique de la cascade Folio (valeur .odt explicite du style > surcharge par
// rôle Scribe, à venir > défaut global). Structuré en objet nommé pour accueillir
// les prochaines propriétés générales (justification, veuves/orphelines…) sans
// migration.

export interface StyleDefaults {
  hyphenation: { global: boolean }
}

export const DEFAULT_STYLE_DEFAULTS: StyleDefaults = { hyphenation: { global: false } }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Erreurs de validation d'un corps entrant. Vide = valide. Vérifié côté serveur :
// le client peut être en retard d'un déploiement.
export function styleDefaultsErrors(body: unknown): string[] {
  const errors: string[] = []
  if (body == null) return errors // null/absent = « aucun réglage », légitime
  if (!isObject(body)) return ['styleDefaults doit être un objet']

  const h = body.hyphenation
  if (h != null) {
    if (!isObject(h)) {
      errors.push('hyphenation doit être un objet')
    } else if (h.global != null && typeof h.global !== 'boolean') {
      errors.push('hyphenation.global doit être un booléen')
    }
  }
  return errors
}

// Rend un objet propre et complet : toute clé absente retombe sur son défaut. On
// stocke toujours la forme entière (pas d'entrée « morte » à interpréter côté
// lecture). Suppose `styleDefaultsErrors` déjà passé.
export function normalizeStyleDefaults(raw: unknown): StyleDefaults {
  const global = isObject(raw) && isObject(raw.hyphenation) && raw.hyphenation.global === true
  return { hyphenation: { global } }
}
