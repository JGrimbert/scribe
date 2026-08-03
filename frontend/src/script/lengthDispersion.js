// Dispersion des longueurs de chapitre, par niveau de titre. Logique PURE : le
// dashboard n'a rien à calculer côté NLP ici — tout sort de trame + data, donc la
// card est toujours disponible (cf. `needs: null` dans DASHBOARD_STEPS).
//
// Le propos : une moyenne écrase l'information qui compte pour la maquette. Trois
// chapitres de 4 000 signes et un de 60 000 ne se paginent pas comme quatre
// chapitres de 18 000, et c'est le second cas que la moyenne raconte.
import { STRUCTURE_ZONES, zoneKeyOfDepth } from './zones'

// Un point = un nœud, à sa profondeur. `caracteres` est le poids du SOUS-ARBRE
// (stats agrégées à l'import) : c'est lui qui décide du nombre de pages d'un
// chapitre, donc lui qu'on veut voir disperser — pas le texte propre du nœud.
export function nodeLengths(axes, data) {
  const out = []
  const walk = (node, depth) => {
    out.push({
      id: node.id,
      titre: node.titre ?? '',
      depth,
      zoneKey: zoneKeyOfDepth(depth),
      chars: data?.[node.id]?.stats?.caracteres ?? 0,
    })
    ;(node.children ?? []).forEach((child) => walk(child, depth + 1))
  }
  ;(axes ?? []).forEach((axe) => walk(axe, 0))
  return out
}

// Médiane et non moyenne : un seul chapitre monstre déplacerait la moyenne au
// point de ne plus décrire aucun chapitre réel.
export function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Groupes dans l'ORDRE DES ZONES (niveau 1 → 3+), les niveaux absents omis : un
// axe vide annoncerait un niveau que le document n'a pas.
export function dispersionGroups(axes, data) {
  const points = nodeLengths(axes, data)
  return STRUCTURE_ZONES.map((zone) => {
    const group = points.filter((p) => p.zoneKey === zone.key)
    const chars = group.map((p) => p.chars)
    return {
      key: zone.key,
      label: zone.label,
      points: group,
      median: median(chars),
      min: chars.length ? Math.min(...chars) : 0,
      max: chars.length ? Math.max(...chars) : 0,
    }
  }).filter((g) => g.points.length)
}
