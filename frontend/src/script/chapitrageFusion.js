// Deux styles qui font le MÊME TRAVAIL sous deux noms — « Definition » et
// « mention sous titre » sur le témoin. Les repérer, c'est répondre d'un coup à
// la moitié des écarts au modèle d'un niveau (cf. chapitrageGroupes) : ce n'est
// pas le livre qui est mal écrit, c'est le même rôle qui porte deux étiquettes.
//
// Deux signes, tous deux nécessaires :
//   1. PRESQUE JAMAIS COPRÉSENTS — deux styles qui se côtoient dans un même
//      chapitre ont, par construction, deux fonctions.
//   2. MÊME RANG DOMINANT dans la suite des styles (ordre d'apparition, titre au
//      rang 0) : ils occupent la même place dans la composition d'un chapitre.
//
// Les deux critères sont posés en PROPORTION et non en absolu : sur 818 nœuds,
// « mention sous titre » est au rang 1 dans 533 chapitres et ailleurs dans 3 —
// exiger l'unanimité, c'est ne rien détecter dans un vrai livre. Les seuils
// restent serrés : la fusion réécrit le document, mieux vaut ne rien proposer
// que fondre deux styles distincts.

import { nodeStyleSet } from './chapitrageValidation'
import { deviation } from './chapitrageGroupes'

// Part maximale de nœuds où les deux styles cohabitent (sur ceux qui portent
// l'un ou l'autre) : au-delà, ils coexistent pour de bon.
const MAX_COPRESENCE = 0.02
// Part minimale des occurrences d'un style à son rang dominant : en deçà, il n'a
// pas de place fixe dans la composition, le rang ne prouve rien.
const MIN_RANK_SHARE = 0.8

// Le SEUL rôle dont l'auto-cohabitation est légitime (cf. shapes.js, « corps est
// du remplissage ») : deux styles de corps se répètent DANS un même chapitre et à
// tous les rangs. Les critères rang/copresence de `mergeCandidates` les rejettent
// donc par construction — c'est leur RÔLE identique, pas une statistique, qui
// prouve qu'ils font le même travail (cf. `corpsMergeCandidates`).
const REPEATABLE_ROLE = 'corps'

/**
 * Relevé par style : à quels rangs il apparaît (et combien de fois), et dans
 * quels nœuds.
 * @returns `Map<styleName, { ranks: Map<rank, count>, nodes: Set<nodeId>, count }>`
 */
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

// Le rang que le style occupe le plus souvent, et la part que ce rang représente.
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

// Les styles d'un nœud, `drop` réécrit en `keep`. `drop` nul = les styles tels
// quels (l'état de comparaison).
function remappedStyles(node, titleStyleOf, keep, drop) {
  return new Set(
    [...nodeStyleSet(node.shape, titleStyleOf(node.nodeId))].map((s) => (drop && s === drop ? keep : s)),
  )
}

// Le style qu'on GARDE d'une paire : celui du modèle s'il y figure (c'est le nom
// que le reste de l'écran donne déjà à ce rôle), sinon le plus répandu des deux.
function orderPair(nameA, nameB, model, countA, countB) {
  return model.includes(nameA) || (!model.includes(nameB) && countA >= countB)
    ? [nameA, nameB]
    : [nameB, nameA]
}

// Combien de nœuds seraient conformes au modèle si `drop` comptait pour `keep`.
// `drop` nul = l'état actuel (le point de comparaison).
function conformCount(nodes, modelNames, titleStyleOf, keep, drop) {
  let n = 0
  for (const node of nodes) {
    const { missing, extra } = deviation(remappedStyles(node, titleStyleOf, keep, drop), modelNames)
    if (!missing.length && !extra.length) n++
  }
  return n
}

// Combien de FAMILLES distinctes (groupes à écart identique, cf. groupByDeviation)
// le niveau compte, `drop` éventuellement fondu dans `keep`. La clé est la même
// que celle des groupes affichés : la différence avant/après fusion EST le nombre
// de lignes du graph qui se replient.
function familyCount(nodes, modelNames, titleStyleOf, keep, drop) {
  const keys = new Set()
  for (const node of nodes) {
    const { missing, extra } = deviation(remappedStyles(node, titleStyleOf, keep, drop), modelNames)
    keys.add(JSON.stringify([missing, extra]))
  }
  return keys.size
}

/**
 * Les paires candidates à la fusion, la plus payante d'abord.
 *
 * `keep` est le style du MODÈLE quand l'un des deux y figure (c'est le nom que
 * le reste de l'écran donne déjà à ce rôle) ; sinon le plus répandu des deux.
 * `gain` = nœuds du niveau qui deviendraient conformes au modèle après fusion —
 * il peut être nul (deux ornements équivalents hors modèle : la fusion se
 * défend, elle ne rallie personne).
 *
 * @returns `[{ keep, drop, rank, keptCount, droppedCount, copresent, gain }]`
 */
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

/**
 * Les paires de styles de CORPS candidates à la fusion — l'autre visage du
 * doublon, invisible à `mergeCandidates` : deux styles de corps se répètent dans
 * un chapitre et à tous les rangs, ses critères rang/copresence les écartent.
 * Ici, c'est le RÔLE partagé (`corps`) qui suffit — pas de statistique à valider.
 *
 * Le gain ne se dit pas en conformité (du corps hors modèle n'en rallie aucune)
 * mais en SIMPLIFICATION : `collapsed` = familles du graph (cf. groupByDeviation)
 * qui se replient une fois les deux styles confondus. C'est ce qu'on voit à
 * l'écran fondre.
 *
 * @param roleOf `(styleName) => rôle` (typologie en cours, cf. useStructureShapes)
 * @returns `[{ keep, drop, keptCount, droppedCount, collapsed }]`, le plus payant d'abord
 */
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

// Le gain de CONFORMITÉ d'une fusion : nœuds du niveau rendus conformes au modèle
// si `drop` comptait pour `keep`. Exporté pour le panneau des styles hors modèle,
// où les deux natures de candidat (rôle ou rang) s'annoncent de la même façon
// (« N conformes gagnés »), là où leurs suggestions divergent (conformité vs
// familles repliées).
export function mergeConformGain(nodes, modelNames, titleStyleOf = () => null, keep, drop) {
  const list = nodes ?? []
  const model = modelNames ?? []
  return conformCount(list, model, titleStyleOf, keep, drop) - conformCount(list, model, titleStyleOf, null, null)
}

/**
 * Une ligne par style HORS MODÈLE présent au niveau — le panneau interactif de la
 * vue validation, en regard des familles d'écart. Un style hors modèle est un
 * `extra` : tout nœud qui le porte est, de ce fait, non conforme.
 *
 * Par style :
 *   - `count`        : chapitres du niveau qui le portent
 *   - `problemShare` : part des chapitres NON CONFORMES qu'il touche (0..1) — « quelle
 *                      part du problème est ce style ». Les parts ne totalisent PAS
 *                      100 % : un chapitre cumule ses écarts (deux styles hors
 *                      modèle, ou un `missing` sans aucun style en cause).
 *   - `keep`/`gain`  : cible de fusion (un style du modèle) et conformes gagnés en
 *                      l'y fondant, quand un candidat (rôle OU rang) le fond ; sinon
 *                      null — la ligne n'a pas de bouton.
 *
 * Triées par part du problème décroissante.
 *
 * @param roleOf `(styleName) => rôle`, pour les candidats de corps
 * @returns `[{ name, count, problemShare, keep, gain }]`
 */
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

  // Meilleure cible par style à fondre : le candidat qui rend le plus de chapitres
  // conformes (les deux détecteurs réunis, gain recompté à l'identique).
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
