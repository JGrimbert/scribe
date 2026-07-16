import { STRUCTURE_ZONES, zoneKeyOfDepth } from './zones'

// Des formes de nœuds (séquences de styles, en RLE) aux MODÈLES : les schémas
// récurrents par niveau. Logique pure — la réactivité est dans
// useStructureShapes.js.
//
// Le backend rend des styles, cette couche les traduit en rôles avec la
// typologie EN COURS D'ÉDITION : c'est ce qui permet de voir les motifs se
// former à mesure qu'on typologise, sans aller-retour réseau (cf.
// analyse/structure-shapes.ts).

// Un nœud sans texte propre n'a pas de forme — il n'est pas encore écrit. Le
// distinguer n'est pas un détail : sur le manuscrit témoin, « vide » est la
// signature la plus fréquente à TOUS les niveaux (228 articles sur 818). La
// promouvoir en modèle reviendrait à proposer « un chapitre ne doit rien
// contenir » comme règle. On la compte à part, et on ne la propose jamais.
export const EMPTY_SIGNATURE = '(vide)'

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

// La signature lisible d'une forme : « chapeau · corps×4 · renvoi ».
export function signatureLabel(roleRuns) {
  if (!roleRuns.length) return EMPTY_SIGNATURE
  return roleRuns.map(([role, n]) => (n > 1 ? `${role}×${n}` : role)).join(' · ')
}

/**
 * Regroupe les formes par niveau, puis par signature identique.
 *
 * Signatures EXACTES, pas de clustering — décision prise sur les chiffres du
 * témoin, pas par principe : 8 signatures y couvrent 87 à 100 % des nœuds de
 * chaque niveau. Les motifs sont littéraux ; un regroupement flou ne ferait que
 * brouiller ce qui est déjà net. À rouvrir seulement si un manuscrit montre une
 * longue traîne dispersée.
 *
 * @param shapes  [{ nodeId, titre, depth, isLeaf, runs, highlights }]
 * @param roleOf  (styleName) => rôle
 * @returns [{ zone, total, empty, signatures: [{ key, label, roleRuns, count, pct, nodes }] }]
 */
export function aggregateByDepth(shapes, roleOf) {
  const groups = STRUCTURE_ZONES.map((zone) => ({ zone, total: 0, empty: 0, signatures: [] }))
  const byKey = new Map(groups.map((g) => [g.zone.key, g]))
  const buckets = new Map()

  for (const shape of shapes) {
    const group = byKey.get(zoneKeyOfDepth(shape.depth))
    if (!group) continue
    group.total++

    if (!shape.runs.length) {
      group.empty++
      continue
    }

    const roleRuns = toRoleRuns(shape.runs, roleOf)
    const label = signatureLabel(roleRuns)
    const key = `${group.zone.key}|${label}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, label, roleRuns, count: 0, nodes: [] }
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
