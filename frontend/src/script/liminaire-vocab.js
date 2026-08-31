// Pages liminaires conventionnelles, dans l'ordre de lecture. Vocabulaire FERMÉ (les
// règles de composition les visent). Champs : `obligatoire` (indécochable), `side` (le
// côté attendu par la convention, ou null), `position` (avant/après le récit).
// Dédicace/épigraphe portent un `side` recto : ce sont des ANCRES de parité, sans côté
// imposé elles décaleraient toute la suite.
export const LIMINAIRE_PAGES = [
  { key: 'faux-titre', label: 'Faux-titre', obligatoire: true, side: 'recto', position: 'avant' },
  { key: 'du-meme-auteur', label: 'Du même auteur', obligatoire: false, side: 'recto', position: 'avant' },
  { key: 'page-de-titre', label: 'Page de titre', obligatoire: true, side: 'recto', position: 'avant' },
  { key: 'mentions-legales', label: 'Mentions légales', obligatoire: true, side: 'verso', position: 'avant' },
  { key: 'a-propos-auteur', label: "À propos de l'auteur", obligatoire: false, side: null, position: 'avant' },
  { key: 'epigraphe', label: 'Épigraphe', obligatoire: false, side: 'recto', position: 'avant' },
  { key: 'dedicace', label: 'Dédicace', obligatoire: false, side: 'recto', position: 'avant' },
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

// Nom de style → type liminaire, quand l'auteur a nommé son style. Signal le plus fiable
// du document : sert à suggérer un type ET à poser une frontière de page (deux styles de
// types différents ne cohabitent pas sur une page). « légal » exigé : « mention sous
// titre » est un sous-titre, pas un copyright.
const STYLE_TYPE_PATTERNS = [
  [/mentions?\s+l[eé]gal/, 'mentions-legales'],
  [/d[eé]dicace/, 'dedicace'],
  [/[eé]pigraphe|citation/, 'epigraphe'],
  [/faux[-\s]?titre/, 'faux-titre'],
  [/du m[eê]me auteur/, 'du-meme-auteur'],
  [/table des mati|sommaire/, 'table-des-matieres'],
  [/avant[-\s]propos/, 'avant-propos'],
  [/pr[eé]face/, 'preface'],
  [/postface/, 'postface'],
  [/remerciement/, 'remerciements'],
  [/avertissement/, 'avertissement'],
  [/colophon|achev[eé] d.?imprimer/, 'imprimeur'],
]

export function typeOfStyleName(styleName) {
  const s = (styleName || '').toLowerCase()
  if (!s) return null
  for (const [re, key] of STYLE_TYPE_PATTERNS) if (re.test(s)) return key
  return null
}

// 'auto' = pas de contrainte de côté. Distinct du pageStart brut du .odt.
export const PAGE_SIDES = ['auto', 'recto', 'verso']

// Ce qui précède une page, décidé PAR STYLE (miroir du backend, PRECEDES_KINDS) :
// 'break' = ouvre une page ; 'blank' = idem + une page blanche avant (belle page, sans
// parité) ; 'none' = rien d'imposé.
export const PRECEDES_KINDS = ['none', 'break', 'blank']

export const PRECEDES_LABELS = {
  none: 'aucun',
  break: 'saut',
  blank: 'page blanche',
}

// Côté imposé par un pageStart du .odt (recto/verso le portent, un simple saut n'impose
// rien).
export function sideOfPageStart(pageStart) {
  return pageStart === 'recto' || pageStart === 'verso' ? pageStart : 'auto'
}
