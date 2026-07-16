import { StyleInventory } from '../import/odt-parser'

// Typologie des styles d'un document : quel RÔLE joue chaque style ODT, et que
// signifie chaque couleur de surlignage. Propre à un document — deux manuscrits
// n'ont aucune raison de nommer leurs styles pareil.
//
// Le vocabulaire est fermé (et pas du texte libre) parce que les règles
// d'éligibilité à la validation vont le viser : une étiquette libre, c'est une
// faute de frappe qui casse une règle en silence.

export const STYLE_ROLES = [
  'corps', // le texte courant
  'titre',
  'chapeau', // intro/accroche en tête de chapitre
  'citation',
  'définition',
  'renvoi', // lien vers un autre passage (« Voir »)
  'tableau',
  'liste',
  'ornement', // filet, astérisme — décoratif, sans contenu
  'liminaire', // page de titre, auteur, dédicace, mentions légales
  'ignorer', // hors analyse (sommaire, artefacts)
] as const

export type StyleRole = (typeof STYLE_ROLES)[number]

// Un surlignage dit quelque chose de l'état du texte, pas de sa structure.
// « annotation » est le cas qui compte : du travail en attente, qui doit
// interdire la validation d'un chapitre (cf. règles d'éligibilité).
export const HIGHLIGHT_ROLES = ['annotation', 'emphase', 'ignorer'] as const

export type HighlightRole = (typeof HIGHLIGHT_ROLES)[number]

export interface DocumentTypology {
  // Par nom de style effectif → rôle. Les styles absents de la carte n'ont pas
  // encore été arbitrés (cf. isTypologySettled).
  styles: Record<string, StyleRole>
  highlights: Record<string, HighlightRole>
}

// Suggestions par nom de style. Ce ne sont QUE des propositions : c'est
// l'utilisateur qui tranche dans l'écran de typologie, et sa décision est
// persistée. Historiquement, ces motifs étaient en dur dans hierarchy.ts
// (/citation|quote/i, /highlight|surlign/i) et faisaient autorité sans que
// personne puisse les corriger — d'où cet écran.
const SUGGESTIONS: [RegExp, StyleRole][] = [
  // Avant la règle « contents » : « Table Contents » est le style LibreOffice
  // des paragraphes DANS une cellule de tableau, pas une ligne de sommaire.
  [/^table (contents|heading)/i, 'tableau'],
  [/contents|index|sommaire/i, 'ignorer'],
  [/heading|titre|title/i, 'titre'],
  [/chapeau|premier paragraphe|intro/i, 'chapeau'],
  [/citation|quotation|quote/i, 'citation'],
  [/definition|définition/i, 'définition'],
  [/voir|renvoi/i, 'renvoi'],
  [/tab\b|tableau|table/i, 'tableau'],
  [/puce|list/i, 'liste'],
  [/couyard|ast[ée]risme|ornement|horizontal line|filet/i, 'ornement'],
  [/auteur|d[ée]dicace|mentions? l[ée]gales|header|footer|colophon/i, 'liminaire'],
]

export function suggestRole(styleName: string): StyleRole {
  for (const [pattern, role] of SUGGESTIONS) {
    if (pattern.test(styleName)) return role
  }
  return 'corps'
}

// Un surlignage est présumé annotation : sur le manuscrit témoin, c'est ce
// qu'ils sont tous (« → Pourquoi écrire ? », « à reprendre »). Se tromper dans
// ce sens est sans danger — ça retient une validation le temps que
// l'utilisateur requalifie la couleur, l'inverse laisserait passer un chapitre
// truffé de travail en attente.
export function suggestHighlightRole(): HighlightRole {
  return 'annotation'
}

// Typologie de départ pour PRÉ-REMPLIR l'écran de configuration. Jamais
// persistée telle quelle : tant que l'utilisateur n'a pas enregistré, la
// colonne reste nulle et la typologie est « non arbitrée ». Sauver les
// suggestions à l'import reviendrait à faire signer la machine à la place de
// l'auteur — et rendrait isTypologySettled vrai sans que personne n'ait rien
// décidé.
export function suggestTypology(inventory: StyleInventory): DocumentTypology {
  return {
    styles: Object.fromEntries(inventory.styles.map((s) => [s.name, suggestRole(s.name)])),
    highlights: Object.fromEntries(inventory.highlights.map((h) => [h.color, suggestHighlightRole()])),
  }
}

// Contrôle du payload avant persistance. Le vocabulaire étant fermé et les
// règles d'éligibilité s'appuyant dessus, un rôle inconnu qui s'installerait en
// base casserait une règle plus tard, loin d'ici — autant refuser tout de
// suite. Idem pour un style absent de l'inventaire : c'est un client qui parle
// d'un document qu'il n'a pas.
export function typologyErrors(
  body: { styles: Record<string, string>; highlights: Record<string, string> },
  inventory: StyleInventory,
): string[] {
  const errors: string[] = []
  const knownStyles = new Set(inventory.styles.map((s) => s.name))
  const knownColors = new Set(inventory.highlights.map((h) => h.color))

  for (const [name, role] of Object.entries(body.styles ?? {})) {
    if (!knownStyles.has(name)) errors.push(`Style inconnu dans ce document : « ${name} »`)
    if (!STYLE_ROLES.includes(role as StyleRole)) errors.push(`Rôle inconnu : « ${role} » (style « ${name} »)`)
  }
  for (const [color, role] of Object.entries(body.highlights ?? {})) {
    if (!knownColors.has(color)) errors.push(`Surlignage inconnu dans ce document : « ${color} »`)
    if (!HIGHLIGHT_ROLES.includes(role as HighlightRole)) errors.push(`Rôle de surlignage inconnu : « ${role} » (${color})`)
  }
  return errors
}

// La typologie est-elle arbitrée ? Deux façons d'être « non arbitrée » : rien
// n'a jamais été enregistré, ou un style est apparu depuis (réimport d'une
// version où l'auteur a introduit un nouveau style) et n'a pas été tranché.
// Le second cas est la raison d'être de la comparaison à l'inventaire plutôt
// que d'un simple booléen « déjà configuré ».
export function isTypologySettled(typology: DocumentTypology | null, inventory: StyleInventory): boolean {
  if (!typology) return false
  return (
    inventory.styles.every((s) => s.name in typology.styles) &&
    inventory.highlights.every((h) => h.color in typology.highlights)
  )
}
