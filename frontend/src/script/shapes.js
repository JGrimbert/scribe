import { STRUCTURE_ZONES, zoneKeyOfDepth } from './zones'

// Des formes de nœuds (séquences de styles, en RLE) aux MODÈLES : les schémas
// récurrents par niveau. Logique pure — la réactivité est dans
// useStructureShapes.js.
//
// Le backend rend des styles, cette couche les traduit en rôles avec la
// typologie EN COURS D'ÉDITION : c'est ce qui permet de voir les motifs se
// former à mesure qu'on typologise, sans aller-retour réseau (cf.
// analyse/structure-shapes.ts).

// Rôles qui ne « rédigent » pas un nœud : un nœud qui n'a QUE ceux-là (ou rien)
// est un squelette — un titre seul, un filet — jamais un modèle. `corps` en est
// exclu : un paragraphe de corps est du texte rédigé.
const SKELETON_ROLES = new Set(['titre', 'ornement', 'ignorer'])

// Traduit les runs de styles en runs de RÔLES, en refusionnant les voisins :
// deux styles différents qui portent le même rôle ne font qu'un run (« corps ×5
// » et non « corps ×2 · corps ×3 »). C'est tout l'intérêt de passer par les
// rôles — la forme se lit au niveau du sens, pas de la mise en forme.
export function toRoleRuns(runs, roleOf) {
  const out = []
  for (const [styleName, count] of runs) {
    const role = roleOf(styleName)
    const last = out[out.length - 1]
    if (last && last[0] === role) last[1] += count
    else out.push([role, count])
  }
  return out
}

// Un nœud est rédigé s'il porte au moins un rôle substantiel (hors titre /
// ornement / ignorer). Runs vides compris : `some` sur [] est faux.
export function isWritten(roleRuns) {
  return roleRuns.some(([role]) => !SKELETON_ROLES.has(role))
}

// La SIGNATURE GROSSIE d'une forme : le titre en tête, puis les rôles saillants
// dans l'ordre. Trois réductions volontaires, pour que des formes proches se
// rejoignent au lieu de peupler une longue traîne de quasi-doublons :
//  - le titre du nœud (heading) n'est jamais dans `texte` : on le PRÉFIXE
//    systématiquement. Un rôle « titre » venu du corps est l'anomalie d'un style
//    mal typé (un sous-titre pris pour un titre) : on ne le RENOMME pas — il
//    disparaît, la forme converge vers ce qu'elle devrait être ;
//  - `corps` est du remplissage : retiré de la clé (sinon un corps final ou un
//    cycle « citation · corps » répété scinderait deux formes identiques). Un
//    article sans rôle saillant garde tout de même un « corps » pour ne pas se
//    confondre avec un squelette (titre seul) ;
//  - rôles consécutifs identiques dédoublonnés (une fois le corps retiré,
//    « citation · corps · citation » devient « citation »).
export function coarseSignature(roleRuns) {
  const salient = []
  let hasBody = false
  for (const [role] of roleRuns) {
    if (role === 'titre') continue
    if (role === 'corps') {
      hasBody = true
      continue
    }
    if (salient[salient.length - 1] === role) continue
    salient.push(role)
  }
  if (salient.length === 0) return hasBody ? ['titre', 'corps'] : ['titre']
  return ['titre', ...salient]
}

/**
 * Regroupe les formes par niveau, puis par signature grossie identique.
 *
 * Les nœuds NON RÉDIGÉS sont comptés à part (`empty`) et jamais proposés en
 * modèle : squelettes (que titre/ornement — « vide » est la forme la plus
 * fréquente à tous les niveaux) et, si le niveau porte un seuil « au moins N
 * caractères », les nœuds sous ce seuil (`minCharsOf`). Le reste est groupé par
 * signature grossie (cf. `coarseSignature`) : des formes qui ne diffèrent que
 * par un corps de remplissage ou une répétition se rejoignent.
 *
 * @param shapes      [{ nodeId, titre, depth, isLeaf, runs, chars, highlights }]
 * @param roleOf      (styleName) => rôle
 * @param minCharsOf  (zoneKey) => seuil de caractères du niveau, ou null
 * @returns [{ zone, total, empty, signatures: [{ key, label, roleRuns, count, pct, nodes }] }]
 */
export function aggregateByDepth(shapes, roleOf, minCharsOf = () => null) {
  const groups = STRUCTURE_ZONES.map((zone) => ({ zone, total: 0, empty: 0, signatures: [] }))
  const byKey = new Map(groups.map((g) => [g.zone.key, g]))
  const buckets = new Map()

  for (const shape of shapes) {
    const group = byKey.get(zoneKeyOfDepth(shape.depth))
    if (!group) continue
    group.total++

    const roleRuns = toRoleRuns(shape.runs, roleOf)
    const minChars = minCharsOf(group.zone.key)
    if (!isWritten(roleRuns) || (minChars != null && shape.chars < minChars)) {
      group.empty++
      continue
    }

    const coarse = coarseSignature(roleRuns)
    const label = coarse.join(' · ')
    const key = `${group.zone.key}|${label}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, label, roleRuns: coarse.map((role) => [role, 1]), count: 0, nodes: [] }
      buckets.set(key, bucket)
      group.signatures.push(bucket)
    }
    bucket.count++
    // Bornés : ils servent à donner un exemple cliquable, pas à recomposer le
    // livre. Une signature à 228 nœuds n'a pas besoin de les lister tous.
    if (bucket.nodes.length < 5) bucket.nodes.push({ nodeId: shape.nodeId, titre: shape.titre })
  }

  for (const group of groups) {
    group.signatures.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    for (const signature of group.signatures) {
      // Part des nœuds ÉCRITS : rapporter à `total` ferait passer un modèle
      // pour marginal alors qu'il régit tout ce qui est rédigé.
      const written = group.total - group.empty
      signature.pct = written ? Math.round((signature.count / written) * 100) : 0
    }
  }

  return groups.filter((g) => g.total > 0)
}
