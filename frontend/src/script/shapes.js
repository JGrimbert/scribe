import { STRUCTURE_ZONES, zoneKeyOfDepth } from './zones'

// Des formes de nœuds (styles en RLE) aux MODÈLES par niveau. Le backend rend des
// styles, cette couche les traduit en rôles avec la typologie en cours d'édition (les
// motifs se forment à mesure qu'on typologise, sans réseau). Logique pure.

// Rôles qui ne « rédigent » pas : un nœud qui n'a QUE ceux-là est un squelette. `corps`
// en est exclu (c'est du texte rédigé).
const SKELETON_ROLES = new Set(['titre', 'ornement', 'ignorer'])

// Runs de styles → runs de RÔLES, voisins de même rôle refusionnés (« corps ×5 » et
// non « corps ×2 · corps ×3 ») : la forme se lit au niveau du sens.
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

export function isWritten(roleRuns) {
  return roleRuns.some(([role]) => !SKELETON_ROLES.has(role))
}

// Signature grossie d'une forme : titre en tête, puis rôles saillants. Trois réductions
// pour que des formes proches se rejoignent : titre toujours préfixé (le heading n'est
// pas dans `texte`) ; `corps` retiré de la clé (remplissage) mais un article sans rôle
// saillant garde un « corps » pour ne pas se confondre avec un squelette ; rôles
// consécutifs identiques dédoublonnés.
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

// Regroupe les formes par niveau puis par signature grossie. Les nœuds non rédigés sont
// comptés à part (`empty`, jamais proposés en modèle) : squelettes, et nœuds sous le
// seuil « au moins N caractères » du niveau.
// [{ zone, total, empty, signatures: [{ key, label, roleRuns, count, pct, nodes }] }]
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
    // Bornés : un exemple cliquable, pas de quoi recomposer le livre.
    if (bucket.nodes.length < 5) bucket.nodes.push({ nodeId: shape.nodeId, titre: shape.titre })
  }

  for (const group of groups) {
    group.signatures.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    for (const signature of group.signatures) {
      // Part des nœuds ÉCRITS (rapporter à `total` ferait passer un modèle régissant
      // tout le rédigé pour marginal).
      const written = group.total - group.empty
      signature.pct = written ? Math.round((signature.count / written) * 100) : 0
    }
  }

  return groups.filter((g) => g.total > 0)
}
