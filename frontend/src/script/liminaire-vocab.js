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
  // Dédicace et épigraphe vont sur une belle page (recto), verso blanc avant :
  // ce sont des ANCRES de parité, pas des pages libres — sans côté imposé elles
  // dérivent et décalent toute la suite du liminaire.
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

// Nom de style → type liminaire, quand l'auteur a NOMMÉ son style (« mentions
// légales », « Dédicace », « Citation liminaire »…). C'est le signal le plus
// fiable du document, et il sert deux fois : à suggérer un type
// (liminaire-suggest) ET à poser une frontière de page (groupLiminairePages) —
// deux styles de types différents ne peuvent pas cohabiter sur une page.
// Vit ici, avec le vocabulaire, pour que les deux usages ne divergent pas.
// « mentions LÉGALES » exige « légal » : un style « mention sous titre » (le
// sous-titre de la page de titre) est un sous-titre, pas un copyright.
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

// Côtés qu'une page peut imposer. 'auto' = pas de contrainte (le composer
// laisse la parité couler). Séparé du pageStart brut du .odt, qui peut valoir
// 'page' (simple saut, sans côté) → côté 'auto'.
export const PAGE_SIDES = ['auto', 'recto', 'verso']

// Le côté imposé par un pageStart lu du .odt : recto/verso le portent, un simple
// saut ('page') ou rien n'imposent aucun côté.
export function sideOfPageStart(pageStart) {
  return pageStart === 'recto' || pageStart === 'verso' ? pageStart : 'auto'
}
