// Le MODÈLE d'un niveau = la suite des styles du nœud témoin (premier du niveau).
// Logique pure ; le choix du témoin et la réactivité vivent dans components/maquette.

// Styles du nœud témoin, dédoublonnés, dans l'ordre de lecture. Le titre n'est pas
// une entrée de `texte` : préfixé à la main, sinon le style qui ouvre tout chapitre
// manquerait au modèle. Les paragraphes sans style (imports anciens) sont écartés.
export function modelStyleNames(shape, titleStyle = null) {
  const out = []
  const push = (name) => {
    if (name && !out.includes(name)) out.push(name)
  }
  push(titleStyle)
  for (const [name] of shape?.runs ?? []) push(name)
  return out
}

// Sépare les styles d'un niveau : ceux du modèle (dans son ordre) et les autres (ordre
// de l'inventaire). Un style du modèle absent de l'inventaire (à cheval sur une autre
// zone) est tout de même rendu sous une forme minimale (nom + rôle).
export function splitByModel(styles, modelNames) {
  const known = new Map((styles ?? []).map((s) => [s.name, s]))
  const inModel = new Set(modelNames ?? [])
  return {
    model: (modelNames ?? []).map((name) => known.get(name) ?? { name, headings: 0, sample: '' }),
    others: (styles ?? []).filter((s) => !inModel.has(s.name)),
  }
}
