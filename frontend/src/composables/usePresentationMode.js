/**
 * Composable pour gérer les modes de présentation de la maquette.
 * 
 * Modes disponibles :
 * - 'default': Présentation par défaut selon le contexte
 * - 'unified': Présentation unifiée (Liminaire/Chapitrage harmonisés avec Format)
 * - 'torn': Aperçu déchiré montrant les portions manquantes
 */
import { ref, computed } from 'vue'

const PRESENTATION_MODES = [
  { value: 'default', label: 'Par défaut' },
  { value: 'unified', label: 'Unifiée' },
  { value: 'torn', label: 'Aperçu déchiré' },
]

/**
 * Gère les modes de présentation et leurs configurations.
 * 
 * @param {Object} options - Options de configuration
 * @param {Object} options.focusedSourceKey - Ref ou computed string pour la source active
 */
export function usePresentationMode(options = {}) {
  const { 
    focusedSourceKey = computed(() => null)
  } = options

  // Mode de présentation actuel - peut être forcé par l'utilisateur
  const presentationMode = ref('default')
  
  // Indique si on est dans un contexte où le sélecteur doit être affiché
  // (Liminaire ou Chapitrage uniquement)
  const showPresentationSelect = computed(() => {
    const source = focusedSourceKey.value
    return source === 'liminaire' || source === 'chapitrage'
  })

  // Modes disponibles pour le sélecteur
  const availableModes = computed(() => {
    const source = focusedSourceKey.value
    
    if (source === 'liminaire' || source === 'chapitrage') {
      return PRESENTATION_MODES
    }
    
    return []
  })

  // Mode actif (peut être différent du mode par défaut si l'utilisateur a fait un choix)
  const activeMode = computed(() => {
    if (presentationMode.value !== 'default') {
      return presentationMode.value
    }
    const source = focusedSourceKey.value
    if (source === 'liminaire' || source === 'chapitrage') {
      return 'unified'
    }
    return 'default'
  })

  // Configuration des styles selon le mode actif
  const presentationConfig = computed(() => {
    const mode = activeMode.value
    const config = {
      // Pour les callouts de style
      showFuyantes: true,
      breakFuyantesAtGutter: true,
      dottedBorders: false,
      borderVisibility: 'hover',
      hoverEffect: 'border', // 'border' ou 'font-color-only'
      
      // Pour le mode déchiré
      showTornEffect: false,
      showMissingPortions: false,
    }
    
    switch (mode) {
      case 'unified':
        // Harmonisation Liminaire/Chapitrage avec Format
        // Les fuyantes se brisent à la gouttière
        config.breakFuyantesAtGutter = true
        // Borders pointillés toujours visibles
        config.dottedBorders = true
        config.borderVisibility = 'always'
        // Survol active uniquement la couleur de font
        config.hoverEffect = 'font-color-only'
        break
        
      case 'torn':
        // Mode déchiré
        config.showTornEffect = true
        config.showMissingPortions = true
        config.breakFuyantesAtGutter = true
        break
    }
    
    return config
  })

  function setPresentationMode(mode) {
    presentationMode.value = mode
  }

  function resetToDefault() {
    presentationMode.value = 'default'
  }

  return {
    presentationMode,
    availableModes,
    activeMode,
    showPresentationSelect,
    presentationConfig,
    setPresentationMode,
    resetToDefault,
    PRESENTATION_MODES
  }
}
