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

// Hash djb2 stable (sans dépendance crypto) — assez pour distinguer une poignée
// d'entrées liminaires.
function hashText(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Clé STABLE d'une entrée : hash de son texte + son rang d'occurrence. Deux
// « JŌHĀNĀN & MARVĀRĪD » (faux-titre puis page de titre) ne doivent pas partager
// la même clé ; les pages blanches, toutes vides, non plus. Stable sous
// fusion/scission (les entrées ne bougent pas, seul leur regroupement change) —
// c'est ce qui laisse la config, keyée par entrée, survivre à un changement de
// frontières comme à un reparse.
export function withEntryKeys(entries) {
  const seen = new Map()
  return (entries ?? []).map((entry) => {
    const text = entryPlainText(entry)
    const occ = seen.get(text) ?? 0
    seen.set(text, occ + 1)
    return { ...entry, key: `le_${hashText(`${text}#${occ}`)}`, isBlank: text === '' }
  })
}

// Regroupe les entrées en PAGES. Une entrée ouvre une page si :
//  - c'est la première ; ou
//  - la config force `break: 'start'` (scission manuelle) ; ou
//  - elle porte un `pageStart` du .odt ET la config ne force pas `'joined'`
//    (fusion manuelle avec la page précédente).
// Le côté RÉEL (`sideFromOdt`) et le tag (type/côté) sont ancrés sur la PREMIÈRE
// entrée de la page (`key`). Une page dont toutes les entrées sont vides est une
// page blanche (`isBlank`), non taggable.
export function groupLiminairePages(entries, config = {}) {
  const keyed = withEntryKeys(entries)
  const pages = []
  keyed.forEach((entry, i) => {
    const brk = config?.[entry.key]?.break
    const starts = i === 0 || brk === 'start' || (brk !== 'joined' && entry.pageStart != null)
    if (starts || !pages.length) {
      pages.push({ ordinal: pages.length, key: entry.key, sideFromOdt: sideOfPageStart(entry.pageStart), entries: [] })
    }
    pages[pages.length - 1].entries.push(entry)
  })
  for (const page of pages) {
    const content = page.entries.filter((e) => !e.isBlank)
    page.isBlank = content.length === 0
    page.preview = content.map(entryPlainText).find((t) => t) ?? ''
  }
  return pages
}

// L'éligibilité du liminaire, dérivée du tagging (pas une saisie à part) —
//  - `obligatoires` : les trois pages minimales, avec leur présence.
//  - `presentTypes` : tous les types assignés (pour cocher les optionnels).
//  - `conflicts` : une page dont le côté CHOISI contredit le côté conventionnel
//    de son type (mentions légales en recto, p. ex.). 'auto' ne contredit rien.
//  - `duplicates` : un type conventionnel assigné à plusieurs pages (une page de
//    titre en double n'est pas une page de titre plus sûre).
// Les pages blanches sont hors jeu (elles ne portent pas de type).
export function deriveEligibility(pages, config) {
  const assigned = (pages ?? []).filter((p) => !p.isBlank).map((page) => ({
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
