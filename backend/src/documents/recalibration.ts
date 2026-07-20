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

// Un nœud tel qu'il existe en base AVANT la reconstruction.
export interface ExistingNode {
  nodeId: string
  slug: string
  currentHash: string
}

export interface IdRemapResult {
  // Id fraîchement généré par `harmonize()` → id EXISTANT à réutiliser à sa
  // place. Une clé n'étant unique que si elle désigne un seul nœud de chaque
  // côté, un id existant ne peut être réutilisé qu'une fois : pas de collision
  // de clé primaire possible.
  reuse: Map<string, string>
  // Nœuds reconstruits qui gardent leur id neuf (nouveaux, ou ambigus).
  fresh: number
  // Nœuds qui existaient et qu'on n'a pas su retrouver. Leur id disparaît, donc
  // les analyses qui le référencent pointent désormais dans le vide — c'est ce
  // compte qu'on remonte à l'utilisateur.
  orphaned: number
}

/**
 * Réattribuer aux nœuds reconstruits l'id de leur prédécesseur, quand on sait
 * les apparier — même critère (slug, texte) et mêmes raisons que
 * `remapValidations`, dont ceci est la généralisation.
 *
 * L'enjeu dépasse les validations : `DocumentAnalysis` (lexical, semantic,
 * topics) indexe des `nodeId`. Tant que les ids changeaient à chaque parse, la
 * seule issue honnête était de jeter les analyses — donc de refaire des minutes
 * de calcul NLP pour avoir déplacé une borne. En conservant les ids, un
 * recalibrage cesse d'être une opération destructrice.
 *
 * Les nœuds ambigus (mêmes slug et texte de part et d'autre — sur le témoin,
 * les centaines de chapitres vides) gardent un id neuf : réutiliser un id au
 * jugé rattacherait l'analyse d'un chapitre à un autre, ce qui ment en silence.
 */
export function remapNodeIds(previous: ExistingNode[], next: RebuiltNode[]): IdRemapResult {
  const before = uniqueByKey(previous, (p) => keyOf(p.slug, p.currentHash))
  const after = uniqueByKey(next, (n) => keyOf(n.slug, n.currentHash))

  const reuse = new Map<string, string>()
  for (const node of next) {
    const key = keyOf(node.slug, node.currentHash)
    // Ambigu d'un côté ou de l'autre : personne n'est désigné.
    if (before.get(key) === null || after.get(key) === null) continue
    const match = before.get(key)
    if (match) reuse.set(node.nodeId, match.nodeId)
  }

  const reused = new Set(reuse.values())
  return {
    reuse,
    fresh: next.length - reuse.size,
    orphaned: previous.filter((p) => !reused.has(p.nodeId)).length,
  }
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
