// Les pages liminaires conventionnelles, dans l'ordre de lecture. Vocabulaire
// FERMÉ (comme STYLE_ROLES) : les règles de composition les visent, une
// étiquette libre serait une faute de frappe qui casse une vérification en
// silence. Glossaire / index viendront côté partie finale, pas ici.
//
// - `obligatoire` : indécochable dans la checklist (faux-titre, page de titre,
//   mentions légales — le minimum d'un livre).
// - `side` : le côté ATTENDU par la convention (recto = page impaire, verso =
//   paire), ou null quand la convention n'impose rien. Distinct du côté RÉEL
//   lu du .odt (pageStart) et du côté CHOISI par l'utilisateur (config).
// - `position` : avant ou après le récit.
export const LIMINAIRE_PAGES = [
  { key: 'faux-titre', label: 'Faux-titre', obligatoire: true, side: 'recto', position: 'avant' },
  { key: 'du-meme-auteur', label: 'Du même auteur', obligatoire: false, side: 'recto', position: 'avant' },
  { key: 'page-de-titre', label: 'Page de titre', obligatoire: true, side: 'recto', position: 'avant' },
  { key: 'mentions-legales', label: 'Mentions légales', obligatoire: true, side: 'verso', position: 'avant' },
  { key: 'a-propos-auteur', label: "À propos de l'auteur", obligatoire: false, side: null, position: 'avant' },
  { key: 'epigraphe', label: 'Épigraphe', obligatoire: false, side: null, position: 'avant' },
  { key: 'dedicace', label: 'Dédicace', obligatoire: false, side: null, position: 'avant' },
  { key: 'table-des-matieres', label: 'Table des matières', obligatoire: false, side: null, position: 'avant' },
  { key: 'preface', label: 'Préface', obligatoire: false, side: null, position: 'avant' },
  { key: 'avant-propos', label: 'Avant-propos', obligatoire: false, side: null, position: 'avant' },
  { key: 'avertissement', label: 'Avertissement', obligatoire: false, side: null, position: 'avant' },
  { key: 'remerciements', label: 'Remerciements', obligatoire: false, side: null, position: 'avant' },
  { key: 'personnages', label: 'Principaux personnages', obligatoire: false, side: null, position: 'avant' },
  { key: 'postface', label: 'Postface', obligatoire: false, side: null, position: 'apres' },
  { key: 'colophon', label: 'Colophon', obligatoire: false, side: null, position: 'apres' },
  { key: 'imprimeur', label: "Achevé d'imprimer", obligatoire: false, side: 'verso', position: 'apres' },
]

export const LIMINAIRE_BY_KEY = new Map(LIMINAIRE_PAGES.map((p) => [p.key, p]))

// Côtés qu'une page peut imposer. 'auto' = pas de contrainte (le composer
// laisse la parité couler). Séparé du pageStart brut du .odt, qui peut valoir
// 'page' (simple saut, sans côté) → côté 'auto'.
export const PAGE_SIDES = ['auto', 'recto', 'verso']

// Le côté imposé par un pageStart lu du .odt : recto/verso le portent, un simple
// saut ('page') ou rien n'imposent aucun côté.
export function sideOfPageStart(pageStart) {
  return pageStart === 'recto' || pageStart === 'verso' ? pageStart : 'auto'
}

// Retire les marqueurs (<mark>, <a data-bookmark>…) pour un aperçu / une clé
// lisibles : le texte d'une entrée porte des balises, pas seulement des mots.
function stripTags(html) {
  return (html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// Texte brut d'une entrée liminaire (paragraphe ou liste).
export function entryPlainText(entry) {
  if (!entry) return ''
  if (entry.type === 'list') return (entry.items ?? []).map((i) => stripTags(i.text)).join(' ').trim()
  return stripTags(entry.text)
}

// Regroupe les entrées liminaire en PAGES : une entrée qui porte un `pageStart`
// ouvre une nouvelle page ; les suivantes sans saut s'y rattachent. La toute
// première entrée ouvre la page 1 même sans saut (la première page n'a pas de
// « saut avant »). Chaque page porte le côté RÉEL imposé par son .odt
// (`sideFromOdt`), son aperçu, et une clé stable (cf. pageKey).
export function groupLiminairePages(entries) {
  const pages = []
  for (const entry of entries ?? []) {
    if (!pages.length || entry.pageStart) {
      pages.push({ ordinal: pages.length, sideFromOdt: sideOfPageStart(entry.pageStart), entries: [] })
    }
    pages[pages.length - 1].entries.push(entry)
  }
  for (const page of pages) {
    page.preview = page.entries.map(entryPlainText).find((t) => t) ?? ''
    page.key = pageKey(page)
  }
  return pages
}

// L'éligibilité du liminaire, dérivée du tagging (pas une saisie à part) :
//  - `obligatoires` : les trois pages minimales, avec leur présence.
//  - `presentTypes` : tous les types assignés (pour cocher les optionnels).
//  - `conflicts` : une page dont le côté CHOISI contredit le côté conventionnel
//    de son type (mentions légales en recto, p. ex.). 'auto' ne contredit rien.
//  - `duplicates` : un type conventionnel assigné à plusieurs pages (une page de
//    titre en double n'est pas une page de titre plus sûre).
export function deriveEligibility(pages, config) {
  const assigned = (pages ?? []).map((page) => ({
    page,
    type: config?.[page.key]?.type ?? null,
    side: config?.[page.key]?.side ?? 'auto',
  }))
  const presentTypes = new Set(assigned.map((a) => a.type).filter(Boolean))

  const byType = new Map()
  for (const a of assigned) {
    if (!a.type) continue
    byType.set(a.type, (byType.get(a.type) ?? 0) + 1)
  }

  const obligatoires = LIMINAIRE_PAGES.filter((t) => t.obligatoire).map((t) => ({
    key: t.key,
    label: t.label,
    present: presentTypes.has(t.key),
  }))

  const conflicts = []
  for (const a of assigned) {
    const def = a.type && LIMINAIRE_BY_KEY.get(a.type)
    if (def && def.side && a.side !== 'auto' && a.side !== def.side) {
      conflicts.push({ key: a.page.key, type: a.type, label: def.label, chosen: a.side, expected: def.side })
    }
  }

  const duplicates = [...byType.entries()]
    .filter(([, n]) => n > 1)
    .map(([type, n]) => ({ type, label: LIMINAIRE_BY_KEY.get(type)?.label ?? type, count: n }))

  return { assigned, presentTypes, obligatoires, conflicts, duplicates }
}

// Clé stable d'une page, pour rattacher la config utilisateur (type + côté) à
// travers un reparse : le hash du texte brut concaténé de ses entrées. Ni
// l'ordinal (le découpage bouge), ni l'aperçu seul (deux pages peuvent le
// partager). Un hash djb2, suffisant pour distinguer des pages liminaires (une
// poignée par livre) sans dépendance crypto.
export function pageKey(page) {
  const text = (page.entries ?? []).map(entryPlainText).join('')
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return `lp_${(h >>> 0).toString(36)}`
}
