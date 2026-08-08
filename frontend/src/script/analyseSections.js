// Sections du dashboard d'analyse, dans l'ordre de la page. Vocabulaire FERMÉ et
// partagé : `AnalyseView` en rend ses `<section class="analyse-section">` (le
// `label` est le `data-label` que lit son scroll-spy) et la Maquette les groupe
// en CALQUES (`layer`) — un cran de TÊTE de sa pellicule par calque, plusieurs
// sections empilées au scroll dedans (cf. analyseLayers). Deux listes
// divergeraient à la première section ajoutée — le sommaire de la recherche
// annoncerait un écran qui n'existe plus, ou en oublierait un.
//
// `needs` : l'analyse dont la section dépend (elle n'apparaît qu'une fois cette
// étape révélée). Absent = toujours présente.
// `layer` : le calque de la Maquette qui empile la section (le libellé du calque
// est celui de sa première section). Les sections d'un même calque sont contiguës.
export const ANALYSE_SECTIONS = [
  { key: 'vocabulaire', label: 'Vocabulaire', layer: 'vocabulaire' },
  { key: 'lexical', label: 'Champ lexical', layer: 'lexical' },
  { key: 'themes', label: 'Thèmes', layer: 'lexical' },
  { key: 'flux', label: 'Thèmes au fil du livre', layer: 'lexical' },
  // La complétude/anomalies a quitté le dashboard : elle vit désormais dans le
  // jalon « Annotations » de la Maquette (avancement + chapitres en attente,
  // en regard des fragments annotés). Cf. maquette/MaquetteAnnotations.vue.
  { key: 'semantique', label: 'Proximité sémantique', layer: 'semantique' },
  // Bas de page du dashboard : cards en lecture seule, « à trier plus tard ».
  { key: 'unites', label: 'Statistiques par article', needs: 'lexical', leftover: true, layer: 'semantique' },
  { key: 'entites', label: 'Entités nommées', needs: 'lexical', leftover: true, layer: 'semantique' },
]

// Les sections effectivement montrables, `revealed(step)` disant si une étape
// d'analyse est déjà révélée (cf. useAnalyse.isRevealed).
export function visibleSections(revealed) {
  return ANALYSE_SECTIONS.filter((s) => !s.needs || revealed?.(s.needs))
}

// Les CALQUES de la Maquette : les sections visibles groupées par `layer`, dans
// l'ordre. Un calque = un cran de la pellicule de tête ; il empile ses sections
// (scroll vertical) là où le dashboard les rend en `<section>` continues. Le
// libellé du calque est celui de sa première section.
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
