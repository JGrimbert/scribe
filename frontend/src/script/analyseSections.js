// Sections du dashboard d'analyse, dans l'ordre de la page. Vocabulaire FERMÉ et
// partagé : `AnalyseView` en rend ses `<section class="analyse-section">` (le
// `label` est le `data-label` que lit son scroll-spy) et la Maquette en fait les
// crans de son accordéon de recherche. Deux listes divergeraient à la première
// section ajoutée — le sommaire de la recherche annoncerait un écran qui n'existe
// plus, ou en oublierait un.
//
// `needs` : l'analyse dont la section dépend (elle n'apparaît qu'une fois cette
// étape révélée). Absent = toujours présente.
export const ANALYSE_SECTIONS = [
  { key: 'vocabulaire', label: 'Vocabulaire' },
  { key: 'lexical', label: 'Champ lexical' },
  { key: 'themes', label: 'Thèmes' },
  { key: 'flux', label: 'Thèmes au fil du livre' },
  { key: 'anomalies', label: 'Anomalies' },
  { key: 'longueurs', label: 'Longueur des chapitres' },
  { key: 'semantique', label: 'Proximité sémantique' },
  // Bas de page du dashboard : cards en lecture seule, « à trier plus tard ».
  { key: 'unites', label: 'Statistiques par article', needs: 'lexical', leftover: true },
  { key: 'entites', label: 'Entités nommées', needs: 'lexical', leftover: true },
]

// Les sections effectivement montrables, `revealed(step)` disant si une étape
// d'analyse est déjà révélée (cf. useAnalyse.isRevealed).
export function visibleSections(revealed) {
  return ANALYSE_SECTIONS.filter((s) => !s.needs || revealed?.(s.needs))
}

export function sectionByKey(key) {
  return ANALYSE_SECTIONS.find((s) => s.key === key) ?? null
}
