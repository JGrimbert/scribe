// Tier SÉMANTIQUE de la suggestion de type de page liminaire : quand ni le nom
// de style ni les mots-clés ne tranchent (« Introduction » qui est un
// avant-propos), on compare le texte de la page à une DESCRIPTION de référence
// de chaque type, par similarité d'embeddings (sentence-camembert, via le
// service NLP). Le déterministe reste prioritaire côté frontend : ceci ne se
// prononce que sur ce qu'il a laissé.
//
// Seuil calibré sur le manuscrit témoin : « Introduction » → avant-propos à 0,39,
// tous les autres tops sous 0,15. 0,33 capte le vrai, rejette le bruit — mieux
// vaut ne rien rendre qu'un faux positif qui se recopie.
export const SEMANTIC_THRESHOLD = 0.33

// Textes courts : la similarité sémantique y est peu fiable (« Pour Margot »),
// et ces cas-là relèvent du déterministe. En deçà, on ne se prononce pas.
export const SEMANTIC_MIN_WORDS = 8

// Descriptions de référence, une par type (clés alignées sur
// documents/liminaire-config LIMINAIRE_PAGE_TYPES). Rédigées pour DÉCRIRE la
// fonction de la page, pas pour en citer un exemple — c'est ce qui rapproche
// « Introduction… » d'« avant-propos ».
export const LIMINAIRE_TYPE_DESCRIPTIONS: { key: string; description: string }[] = [
  { key: 'faux-titre', description: 'Page de faux-titre : le titre du livre seul, en petits caractères.' },
  { key: 'du-meme-auteur', description: 'Liste des autres ouvrages déjà publiés par le même auteur.' },
  { key: 'page-de-titre', description: 'Page de titre : le titre du livre, le nom de l’auteur et le sous-titre.' },
  { key: 'mentions-legales', description: 'Mentions légales : copyright, ISBN, dépôt légal, éditeur, propriété intellectuelle, tous droits réservés.' },
  { key: 'a-propos-auteur', description: 'Notice biographique à propos de l’auteur : sa vie, son parcours et son œuvre, rédigée à la troisième personne.' },
  { key: 'epigraphe', description: 'Épigraphe : une courte citation empruntée à un autre auteur, placée en exergue.' },
  { key: 'dedicace', description: 'Dédicace : le livre est dédié à une personne chère.' },
  { key: 'table-des-matieres', description: 'Table des matières, sommaire, liste des chapitres et des pages.' },
  { key: 'preface', description: 'Préface : présentation de l’ouvrage écrite par un tiers, un critique ou un spécialiste.' },
  // « Introduction / avant-propos » calibré sur le témoin : le texte y commence
  // par « Introduction → Pourquoi écrire… » et matchait « personnages » de peu
  // avant cet affinage (cf. liminaire-semantic.spec / le seul juge = le vrai texte).
  { key: 'avant-propos', description: 'Introduction ou avant-propos : l’auteur explique lui-même, à la première personne, pourquoi il écrit ce livre, ses motivations, sa démarche et son projet d’écriture.' },
  { key: 'avertissement', description: 'Avertissement au lecteur sur la nature, l’usage ou les limites de l’ouvrage.' },
  { key: 'remerciements', description: 'Remerciements aux personnes ayant aidé à la réalisation du livre.' },
  { key: 'personnages', description: 'Liste des personnages : les noms des protagonistes du roman, chacun suivi d’une brève description de son rôle.' },
  { key: 'postface', description: 'Postface : commentaire ou réflexion de l’auteur placé à la toute fin de l’ouvrage.' },
  { key: 'colophon', description: 'Colophon : notice sur la composition, la typographie et la mise en page du livre.' },
  { key: 'imprimeur', description: 'Achevé d’imprimer : nom de l’imprimeur, lieu et date d’impression.' },
]

export interface SemanticPick {
  type: string
  score: number
}

// À partir de la matrice de similarité de `[...pageTexts, ...descriptions]`,
// retient pour chaque page le type le plus proche s'il dépasse le seuil. Pur —
// testable sans le service NLP.
export function pickBestTypes(
  matrix: number[][],
  nPages: number,
  descriptions: { key: string }[],
  threshold = SEMANTIC_THRESHOLD,
): (SemanticPick | null)[] {
  const out: (SemanticPick | null)[] = []
  for (let i = 0; i < nPages; i++) {
    let best: SemanticPick | null = null
    for (let j = 0; j < descriptions.length; j++) {
      const score = matrix[i]?.[nPages + j] ?? -Infinity
      if (!best || score > best.score) best = { type: descriptions[j].key, score }
    }
    out.push(best && best.score >= threshold ? { type: best.type, score: Math.round(best.score * 1000) / 1000 } : null)
  }
  return out
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
