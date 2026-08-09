// Sections du dashboard d'analyse, dans l'ordre de la page. Vocabulaire FERMÉ et partagé :
// AnalyseView en rend ses <section> (label = data-label du scroll-spy) et la Maquette les
// groupe en CALQUES (`layer`) — un cran de tête par calque. `needs` : l'analyse dont la
// section dépend. `layer` : le calque qui l'empile (libellé = celui de sa 1re section).
export const ANALYSE_SECTIONS = [
  { key: 'vocabulaire', label: 'Vocabulaire', layer: 'vocabulaire' },
  { key: 'lexical', label: 'Champ lexical', layer: 'lexical' },
  { key: 'themes', label: 'Thèmes', layer: 'lexical' },
  { key: 'flux', label: 'Thèmes au fil du livre', layer: 'lexical' },
  { key: 'semantique', label: 'Proximité sémantique', layer: 'semantique' },
  { key: 'unites', label: 'Statistiques par article', needs: 'lexical', leftover: true, layer: 'semantique' },
  { key: 'entites', label: 'Entités nommées', needs: 'lexical', leftover: true, layer: 'semantique' },
]

// `revealed(step)` dit si une étape d'analyse est déjà révélée (cf. useAnalyse.isRevealed).
export function visibleSections(revealed) {
  return ANALYSE_SECTIONS.filter((s) => !s.needs || revealed?.(s.needs))
}

// Sections visibles groupées par `layer` (un calque = un cran de la pellicule de tête).
export function analyseLayers(revealed) {
  const layers = []
  const byKey = new Map()
  for (const s of visibleSections(revealed)) {
    let layer = byKey.get(s.layer)
    if (!layer) {
      layer = { key: s.layer, label: s.label, sections: [] }
      byKey.set(s.layer, layer)
      layers.push(layer)
    }
    layer.sections.push(s)
  }
  return layers
}

export function sectionByKey(key) {
  return ANALYSE_SECTIONS.find((s) => s.key === key) ?? null
}
