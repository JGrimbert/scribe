// Recalibrer un document reconstruit son arbre : `harmonize()` regénère des
// UUID neufs à chaque parse, donc tous les `Node.id` changent et les
// `NodeValidation` (rattachées par FK) tombent avec les nœuds. Or une
// validation est un FAIT UTILISATEUR (« j'ai relu ce chapitre ») — la perdre
// parce qu'on a corrigé le niveau d'un titre à l'autre bout du livre serait
// détruire du travail humain pour une raison technique.
//
// D'où ce ré-appariement : on identifie « le même chapitre » de part et
// d'autre de la reconstruction, et on repose la validation dessus.
//
// ─── Pourquoi (slug + texte) et pas autre chose ───────────────────────────
//
// - **Pas l'id** : c'est précisément ce qui change.
// - **Pas le chemin de titres** : recalibrer CONSISTE à changer la
//   hiérarchie. Un article promu en bloc change de parent — l'identifier par
//   son chemin, c'est le perdre exactement dans le cas qu'on veut servir.
// - **Pas le texte seul** : sur le manuscrit témoin, 228 articles sur 818 sont
//   vides. Ils partagent tous le hash du texte vide ; un appariement par hash
//   seul les confondrait en bloc.
// - **Pas le slug seul** : `makeUniqueSlug` (text-utils.ts) ne garantit
//   l'unicité que PAR PARENT. Deux « Notes » sous deux axes différents ont le
//   même slug.
//
// Le couple des deux est discriminant dans les cas réels, et quand il ne l'est
// pas (deux nœuds de même slug ET de même texte, typiquement deux « Notes »
// vides sous deux parents), on préfère PERDRE la validation que la reposer sur
// le mauvais chapitre : une validation perdue se voit et se refait en un clic,
// une validation posée au mauvais endroit ment en silence sur du texte non
// relu. D'où la règle d'unicité stricte des deux côtés.

export interface PreviousValidation {
  slug: string
  // Hash du texte COURANT du nœud, tel qu'il est en base avant reconstruction.
  // C'est la clé d'identité — pas `storedHash`, qui peut être périmé.
  currentHash: string
  // Le hash tel que stocké dans NodeValidation : celui du texte AU MOMENT de
  // la relecture. Reposé tel quel, pour que `getContent` continue de trancher
  // validé/périmé exactement comme avant la recalibration.
  storedHash: string
  validatedAt: Date
}

export interface RebuiltNode {
  nodeId: string
  slug: string
  currentHash: string
}

export interface RemapResult {
  restore: { nodeId: string; contentHash: string; validatedAt: Date }[]
  // Les validations qu'on n'a pas su reposer, avec la raison — remontées à
  // l'appelant plutôt qu'avalées : recalibrer peut légitimement supprimer un
  // chapitre (une borne qui déplace du corps vers le liminaire), et
  // l'utilisateur a le droit de savoir qu'il a perdu une relecture.
  dropped: { slug: string; reason: 'disparu' | 'ambigu' }[]
}

// Séparateur impossible dans un slug (slugify) comme dans un hash hexa : sans
// lui, « a » + « b-c » et « a-b » + « c » donneraient la même clé. Construit,
// et non écrit en littéral : un NUL brut dans le source ferait passer ce
// fichier pour un binaire aux yeux de git et de grep.
const SEP = String.fromCharCode(0)

function keyOf(slug: string, hash: string): string {
  return `${slug}${SEP}${hash}`
}

// Index par clé, en écartant les clés qui apparaissent plusieurs fois : une
// clé ambiguë ne désigne personne.
function uniqueByKey<T>(items: T[], key: (item: T) => string): Map<string, T | null> {
  const index = new Map<string, T | null>()
  for (const item of items) {
    const k = key(item)
    // Déjà vu → la clé ne discrimine plus : on la neutralise (null) au lieu de
    // la retirer, sinon un troisième homonyme la réintroduirait comme unique.
    index.set(k, index.has(k) ? null : item)
  }
  return index
}

export function remapValidations(previous: PreviousValidation[], next: RebuiltNode[]): RemapResult {
  const before = uniqueByKey(previous, (p) => keyOf(p.slug, p.currentHash))
  const after = uniqueByKey(next, (n) => keyOf(n.slug, n.currentHash))

  const restore: RemapResult['restore'] = []
  const dropped: RemapResult['dropped'] = []

  for (const validation of previous) {
    const key = keyOf(validation.slug, validation.currentHash)

    // Ambigu d'un côté OU de l'autre : deux chapitres identiques avant la
    // reconstruction, ou après, se valent — rien ne permet de choisir.
    if (before.get(key) === null || after.get(key) === null) {
      dropped.push({ slug: validation.slug, reason: 'ambigu' })
      continue
    }

    const match = after.get(key)
    if (!match) {
      dropped.push({ slug: validation.slug, reason: 'disparu' })
      continue
    }

    restore.push({ nodeId: match.nodeId, contentHash: validation.storedHash, validatedAt: validation.validatedAt })
  }

  return { restore, dropped }
}
