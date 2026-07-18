// Le tagging des pages liminaires : quel type conventionnel (faux-titre, page
// de titre…) et quel côté imposé (recto/verso/auto) l'utilisateur assigne à
// chaque page. Keyé par la clé stable de la page (hash de son texte, cf.
// frontend script/liminaire) pour survivre à un recalibrage.
//
// Vocabulaire FERMÉ, aligné sur LIMINAIRE_PAGES côté frontend : une étiquette
// libre serait une faute de frappe qui casse une vérification en silence — même
// raison que STYLE_ROLES pour la typologie.

export const LIMINAIRE_PAGE_TYPES = [
  'faux-titre', 'du-meme-auteur', 'page-de-titre', 'mentions-legales',
  'a-propos-auteur', 'epigraphe', 'dedicace', 'table-des-matieres',
  'preface', 'avant-propos', 'avertissement', 'remerciements',
  'personnages', 'postface', 'colophon', 'imprimeur',
] as const

export type LiminairePageType = (typeof LIMINAIRE_PAGE_TYPES)[number]

export const PAGE_SIDES = ['auto', 'recto', 'verso'] as const
export type PageSide = (typeof PAGE_SIDES)[number]

export interface LiminairePageTag {
  type?: LiminairePageType
  side?: PageSide
}

// { [pageKey]: { type?, side? } }
export type LiminaireConfig = Record<string, LiminairePageTag>

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Erreurs de validation d'une config entrante. Vide = valide. Le vocabulaire est
// vérifié ici, côté serveur : le client peut être en retard d'un déploiement.
export function liminaireConfigErrors(body: unknown): string[] {
  const errors: string[] = []
  if (body == null) return errors // null/absent = « rien tagué », légitime
  if (!isObject(body)) return ['liminaireConfig doit être un objet']

  for (const [key, tag] of Object.entries(body)) {
    if (!isObject(tag)) {
      errors.push(`Page ${key} : entrée invalide`)
      continue
    }
    if (tag.type != null && !LIMINAIRE_PAGE_TYPES.includes(tag.type as LiminairePageType)) {
      errors.push(`Page ${key} : type inconnu « ${String(tag.type)} »`)
    }
    if (tag.side != null && !PAGE_SIDES.includes(tag.side as PageSide)) {
      errors.push(`Page ${key} : côté inconnu « ${String(tag.side)} »`)
    }
  }
  return errors
}

// Rend une config propre : null → {}, entrées vidées de leurs clés hors
// vocabulaire ou vides (un type/side effacé ne doit pas laisser un objet mort).
// Suppose `liminaireConfigErrors` déjà passé (pas de type invalide ici).
export function normalizeLiminaireConfig(raw: unknown): LiminaireConfig {
  if (!isObject(raw)) return {}
  const out: LiminaireConfig = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isObject(value)) continue
    const tag: LiminairePageTag = {}
    if (LIMINAIRE_PAGE_TYPES.includes(value.type as LiminairePageType)) tag.type = value.type as LiminairePageType
    if (PAGE_SIDES.includes(value.side as PageSide) && value.side !== 'auto') tag.side = value.side as PageSide
    // 'auto' est le défaut : ne pas le stocker (bruit). Une entrée sans type ni
    // côté explicite ne mérite pas d'exister.
    if (tag.type || tag.side) out[key] = tag
  }
  return out
}
