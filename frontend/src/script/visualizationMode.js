/**
 * Logique pour le mode visualisation en chapitrage.
 * 
 * En mode visualisation, on affiche :
 * - Colonne gauche : les styles visibles sur la première page (avec rupture déchirée au bas)
 * - Colonne droite : un aperçu de chaque style restant du chapitre non visible page 1
 */

/**
 * Extrait les styles visibles et restants d'un fragment.
 * @param {Object} folio - État du folio/pagination
 * @param {Array} chapitreStyles - Styles du chapitre courant
 * @returns {{visible: Array, remaining: Array}}
 */
export function extractVisualizationLayers(folio, chapitreStyles) {
  if (!folio || !chapitreStyles) {
    return { visible: [], remaining: [] }
  }

  // Les styles visibles sont ceux qui ont un rendu sur la première page
  const visibleStyleKeys = new Set()
  if (folio.pages && folio.pages.length > 0) {
    const firstPage = folio.pages[0]
    if (firstPage.sections) {
      firstPage.sections.forEach((section) => {
        if (section.style) visibleStyleKeys.add(section.style)
      })
    }
  }

  const visible = chapitreStyles.filter((s) => visibleStyleKeys.has(s.key))
  const remaining = chapitreStyles.filter((s) => !visibleStyleKeys.has(s.key))

  return { visible, remaining }
}

/**
 * Applique le style de scène fragmentée (deux colonnes) en mode visualisation.
 * @param {Object} target - L'élément DOM ou élément de style
 * @returns {Object} Styles CSS à appliquer
 */
export function getVisualizationStyles() {
  return {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1em',
  }
}

/**
 * Crée un aperçu fragmenté pour les styles restants.
 * Tire le contenu du rendu existant et le réduit.
 * @param {Object} style - Configuration du style
 * @param {Object} blockGeometry - Géométrie du bloc rendu
 * @returns {Object} Objet décrivant l'aperçu du fragment
 */
export function createPlaceholderPreview(style, blockGeometry) {
  return {
    style: style,
    preview: {
      label: style.name || style.key,
      height: blockGeometry?.[style.key]?.height ?? 'auto',
      type: 'placeholder',
    },
  }
}
