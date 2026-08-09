// Détecter deux styles qui font le même travail sous deux noms (répond à la moitié
// des écarts au modèle d'un niveau). Signes, tous deux nécessaires : presque jamais
// coprésents, et même rang dominant. Seuils serrés (la fusion réécrit le document).

import { nodeStyleSet } from './chapitrageValidation'
import { deviation } from './chapitrageGroupes'

const MAX_COPRESENCE = 0.02
const MIN_RANK_SHARE = 0.8
// Seul rôle dont l'auto-cohabitation est légitime : les critères rang/copresence le
// rejettent, c'est son rôle identique qui le trahit (cf. corpsMergeCandidates).
const REPEATABLE_ROLE = 'corps'

// `Map<styleName, { ranks: Map<rank, count>, nodes: Set<nodeId>, count }>`.
export function styleRanks(nodes, titleStyleOf = () => null) {
  const out = new Map()
  for (const node of nodes ?? []) {
    const styles = [...nodeStyleSet(node.shape, titleStyleOf(node.nodeId))]
    styles.forEach((name, rank) => {
      const entry = out.get(name) ?? { ranks: new Map(), nodes: new Set(), count: 0 }
      entry.ranks.set(rank, (entry.ranks.get(rank) ?? 0) + 1)
      entry.nodes.add(node.nodeId)
      entry.count = entry.nodes.size
      out.set(name, entry)
    })
  }
  return out
}

export function dominantRank(entry) {
  let rank = null
  let best = 0
  let total = 0
  for (const [r, n] of entry?.ranks ?? []) {
    total += n
    if (n > best) { best = n; rank = r }
  }
  return { rank, share: total ? best / total : 0 }
}

// Les styles d'un nœud, `drop` réécrit en `keep` (drop nul = tels quels).
function remappedStyles(node, titleStyleOf, keep, drop) {
  return new Set(
    [...nodeStyleSet(node.shape, titleStyleOf(node.nodeId))].map((s) => (drop && s === drop ? keep : s)),
  )
}

// Le style gardé d'une paire : celui du modèle s'il y figure, sinon le plus répandu.
function orderPair(nameA, nameB, model, countA, countB) {
  return model.includes(nameA) || (!model.includes(nameB) && countA >= countB)
    ? [nameA, nameB]
    : [nameB, nameA]
}

// Nœuds conformes au modèle si `drop` comptait pour `keep` (drop nul = état actuel).
function conformCount(nodes, modelNames, titleStyleOf, keep, drop) {
  let n = 0
  for (const node of nodes) {
    const { missing, extra } = deviation(remappedStyles(node, titleStyleOf, keep, drop), modelNames)
    if (!missing.length && !extra.length) n++
  }
  return n
}

// Nombre de familles distinctes (même clé que groupByDeviation), drop éventuellement
// fondu : la différence avant/après EST le nombre de lignes du graph qui se replient.
function familyCount(nodes, modelNames, titleStyleOf, keep, drop) {
  const keys = new Set()
  for (const node of nodes) {
    const { missing, extra } = deviation(remappedStyles(node, titleStyleOf, keep, drop), modelNames)
    keys.add(JSON.stringify([missing, extra]))
  }
  return keys.size
}

// Paires candidates à la fusion, la plus payante d'abord. `gain` = nœuds rendus
// conformes au modèle (peut être nul).
// `[{ keep, drop, rank, keptCount, droppedCount, copresent, gain }]`
export function mergeCandidates(nodes, modelNames, titleStyleOf = () => null) {
  const list = nodes ?? []
  const model = modelNames ?? []
  const ranks = styleRanks(list, titleStyleOf)
  const names = [...ranks.keys()]
  const base = conformCount(list, model, titleStyleOf, null, null)

  const out = []
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = ranks.get(names[i])
      const b = ranks.get(names[j])
      const copresent = [...a.nodes].filter((id) => b.nodes.has(id)).length
      const union = a.nodes.size + b.nodes.size - copresent
      if (!union || copresent / union > MAX_COPRESENCE) continue

      const da = dominantRank(a)
      const db = dominantRank(b)
      if (da.rank !== db.rank) continue
      if (da.share < MIN_RANK_SHARE || db.share < MIN_RANK_SHARE) continue

      const [keep, drop] = orderPair(names[i], names[j], model, a.count, b.count)
      out.push({
        keep,
        drop,
        rank: da.rank,
        keptCount: ranks.get(keep).count,
        droppedCount: ranks.get(drop).count,
        copresent,
        gain: conformCount(list, model, titleStyleOf, keep, drop) - base,
      })
    }
  }
  return out.sort((x, y) => y.gain - x.gain || y.droppedCount - x.droppedCount)
}

// Paires de CORPS candidates : invisibles à mergeCandidates (mêmes rangs, coprésents),
// détectées par le rôle partagé. `collapsed` = familles du graph qui se replient.
// `[{ keep, drop, keptCount, droppedCount, collapsed }]`
export function corpsMergeCandidates(nodes, roleOf = () => null, modelNames, titleStyleOf = () => null) {
  const list = nodes ?? []
  const model = modelNames ?? []
  const ranks = styleRanks(list, titleStyleOf)
  const corps = [...ranks.keys()].filter((name) => roleOf(name) === REPEATABLE_ROLE)
  const before = familyCount(list, model, titleStyleOf, null, null)

  const out = []
  for (let i = 0; i < corps.length; i++) {
    for (let j = i + 1; j < corps.length; j++) {
      const a = ranks.get(corps[i])
      const b = ranks.get(corps[j])
      const [keep, drop] = orderPair(corps[i], corps[j], model, a.count, b.count)
      out.push({
        keep,
        drop,
        keptCount: ranks.get(keep).count,
        droppedCount: ranks.get(drop).count,
        collapsed: before - familyCount(list, model, titleStyleOf, keep, drop),
      })
    }
  }
  return out.sort((x, y) => y.collapsed - x.collapsed || y.droppedCount - x.droppedCount)
}

// Gain de conformité d'une fusion : nœuds rendus conformes si `drop` comptait pour
// `keep`. Exporté pour le panneau des styles hors modèle (annonce unifiée des deux
// natures de candidat).
export function mergeConformGain(nodes, modelNames, titleStyleOf = () => null, keep, drop) {
  const list = nodes ?? []
  const model = modelNames ?? []
  return conformCount(list, model, titleStyleOf, keep, drop) - conformCount(list, model, titleStyleOf, null, null)
}

// Une ligne par style hors modèle présent au niveau (panneau interactif de validation).
// `problemShare` = part des chapitres non conformes qu'il touche (ne totalise pas 100 %
// — un chapitre cumule ses écarts). `keep`/`gain` non nuls quand un candidat le fond.
// `[{ name, count, problemShare, keep, gain }]`
export function deviationStyleRows(nodes, roleOf = () => null, modelNames, titleStyleOf = () => null) {
  const list = nodes ?? []
  const model = modelNames ?? []
  const inModel = new Set(model)
  const ranks = styleRanks(list, titleStyleOf)

  let nonConform = 0
  for (const node of list) {
    const { missing, extra } = deviation(nodeStyleSet(node.shape, titleStyleOf(node.nodeId)), model)
    if (missing.length || extra.length) nonConform++
  }

  const best = new Map()
  for (const { keep, drop } of [
    ...mergeCandidates(list, model, titleStyleOf),
    ...corpsMergeCandidates(list, roleOf, model, titleStyleOf),
  ]) {
    const gain = mergeConformGain(list, model, titleStyleOf, keep, drop)
    const prev = best.get(drop)
    if (!prev || gain > prev.gain) best.set(drop, { keep, gain })
  }

  const rows = []
  for (const name of ranks.keys()) {
    if (inModel.has(name)) continue
    const target = best.get(name) ?? null
    rows.push({
      name,
      count: ranks.get(name).count,
      problemShare: nonConform ? ranks.get(name).count / nonConform : 0,
      keep: target?.keep ?? null,
      gain: target?.gain ?? null,
    })
  }
  return rows.sort((a, b) => b.problemShare - a.problemShare || b.count - a.count || a.name.localeCompare(b.name))
}
