// Le MODÈLE d'un niveau de chapitrage = la suite des styles du nœud inspecté
// (le témoin, premier nœud du niveau). Logique pure ; la réactivité et le choix
// du témoin vivent dans la vue (components/maquette).
//
// Deux tableaux en découlent dans l'aside : ce que le modèle porte (dans SON
// ordre — c'est une séquence, la succession n'a de sens que là), et ce que le
// niveau porte en plus (dans l'ordre de l'inventaire).

/**
 * Les styles du nœud témoin, dédoublonnés, dans l'ordre de lecture.
 *
 * Le titre n'est PAS une entrée de `texte` (cf. HarmonizedItem.styleName) : il
 * est préfixé à la main, sinon le style qui ouvre tout chapitre manquerait au
 * modèle. Les paragraphes sans style (documents importés avant leur relevé)
 * portent un nom vide : écartés plutôt que rendus comme un style anonyme.
 *
 * @param shape       forme du nœud (`{ runs: [[styleName, n]] }`) ou null
 * @param titleStyle  style du titre du nœud, ou null
 */
export function modelStyleNames(shape, titleStyle = null) {
  const out = []
  const push = (name) => {
    if (name && !out.includes(name)) out.push(name)
  }
  push(titleStyle)
  for (const [name] of shape?.runs ?? []) push(name)
  return out
}

/**
 * Sépare les styles d'un niveau en deux tableaux : ceux du modèle (dans l'ordre
 * du modèle) et les autres (dans l'ordre de l'inventaire).
 *
 * Un style du modèle absent de l'inventaire de la zone (sa zone dominante est
 * ailleurs — un style à cheval) est tout de même rendu : il est dans le nœud
 * inspecté, l'escamoter ferait mentir le tableau. Il arrive alors sous une forme
 * minimale, suffisante pour la table (nom + rôle).
 *
 * @param styles      styles de la zone (`[{ name, … }]`, ordre d'apparition)
 * @param modelNames  noms des styles du modèle (cf. modelStyleNames)
 */
export function splitByModel(styles, modelNames) {
  const known = new Map((styles ?? []).map((s) => [s.name, s]))
  const inModel = new Set(modelNames ?? [])
  return {
    model: (modelNames ?? []).map((name) => known.get(name) ?? { name, headings: 0, sample: '' }),
    others: (styles ?? []).filter((s) => !inModel.has(s.name)),
  }
}
