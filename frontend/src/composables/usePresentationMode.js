/**
 * Composable pour gérer les modes de présentation de la maquette.
 */
import { ref, computed } from 'vue'

const PRESENTATION_MODES = [
  { value: 'default', label: 'Par défaut' },
  { value: 'unified', label: 'Unifiée' },
  { value: 'torn', label: 'Aperçu déchiré' },
]

export function usePresentationMode(options = {}) {
  const { focusedSourceKey = computed(() => null) } = options
  const presentationMode = ref('default')
  
  const showPresentationSelect = computed(() => {
    const source = focusedSourceKey.value
    return source === 'liminaire' || source === 'chapitrage'
  })

  const availableModes = computed(() => {
    return showPresentationSelect.value ? PRESENTATION_MODES : []
  })

  const activeMode = computed(() => {
    if (presentationMode.value !== 'default') return presentationMode.value
    const source = focusedSourceKey.value
    if (source === 'liminaire' || source === 'chapitrage') return 'unified'
    return 'default'
  })

  const presentationConfig = computed(() => {
    const mode = activeMode.value
    const config = {
      breakFuyantesAtGutter: true,
      dottedBorders: false,
      borderVisibility: 'hover',
      hoverEffect: 'border',
      showTornEffect: false,
    }
    
    if (mode === 'unified') {
      config.dottedBorders = true
      config.borderVisibility = 'always'
      config.hoverEffect = 'font-color-only'
    }
    if (mode === 'torn') {
      config.showTornEffect = true
    }
    
    return config
  })

  function setPresentationMode(mode) {
    presentationMode.value = mode
  }

  return {
    presentationMode,
    availableModes,
    activeMode,
    showPresentationSelect,
    presentationConfig,
    setPresentationMode,
    PRESENTATION_MODES
  }
}
