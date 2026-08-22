/**
 * Logique pour le mode visualisation en chapitrage.
 * 
 * En mode visualisation, on affiche :
 * - Colonne gauche : les styles visibles sur la première page (avec rupture déchirée au bas)
 * - Colonne droite : un aperçu de chaque style restant du chapitre non visible page 1
 */

/**
 * Extrait les styles visibles et restants du registre de pagination.
 * @param {Map} registry - Registre de fragments (data-frag-id → style key)
 * @param {Object} frameDoc - Document de l'iframe (ou null)
 * @returns {{visible: Set<string>, remaining: Set<string>}}
 */
export function extractVisualizationLayers(registry, frameDoc) {
  if (!registry || !frameDoc) {
    return { visible: new Set(), remaining: new Set() }
  }

  const visibleStyles = new Set()
  const allStyles = new Set()

  // Parcourir tous les fragments du registre
  registry.forEach((fragData) => {
    if (fragData.style) {
      allStyles.add(fragData.style)
      // Considérer comme visible si le fragment est dans une page
      // (simplification : tous les fragments du registre sont visibles)
      visibleStyles.add(fragData.style)
    }
  })

  // Les styles restants sont ceux du chapitrage qui ne sont pas visibles page 1
  // Cela dépend de la pagination réelle — ici, c'est un placeholder
  const remaining = new Set(
    Array.from(allStyles).filter((style) => !visibleStyles.has(style)),
  )

  return { visible: visibleStyles, remaining }
}

/**
 * Applique le style de scène fragmentée (deux colonnes) en mode visualisation.
 * @returns {Object} Styles CSS à appliquer au conteneur
 */
export function getVisualizationContainerStyles() {
  return {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2em',
    alignItems: 'start',
  }
}

/**
 * Crée un aperçu fragmenté pour un style restant.
 * @param {string} styleName - Nom du style
 * @param {Object} styleGeometry - Géométrie du style (si disponible)
 * @returns {Object} Objet décrivant l'aperçu du placeholder
 */
export function createPlaceholderPreview(styleName, styleGeometry) {
  return {
    styleName,
    label: styleName,
    height: styleGeometry?.height ?? '3em',
    type: 'placeholder',
  }
}

/**
 * Détecte où se termine le contenu visible sur page 1.
 * Cherche le point de rupture (dernier style visible).
 * @param {HTMLDocument} frameDoc - Document de l'iframe
 * @returns {number} Index du dernier élément visible, ou -1 si aucun
 */
export function findFirstPageBreakPoint(frameDoc) {
  if (!frameDoc) return -1

  // Les pages sont .pagedjs_page
  const pages = frameDoc.querySelectorAll('.pagedjs_page')
  if (pages.length === 0) return -1

  const firstPage = pages[0]
  const allElements = frameDoc.querySelectorAll('[data-frag-id]')

  let lastVisibleIndex = -1
  allElements.forEach((el, idx) => {
    if (firstPage.contains(el)) {
      lastVisibleIndex = idx
    }
  })

  return lastVisibleIndex
}
