import { ref, computed } from 'vue'

// Modes de présentation des callouts de styles (jalons Liminaire + Chapitrage, qui
// partagent le MÊME rendu unifié) :
//  · 'default' : callouts unifiés — fuyantes coudées à la gouttière (comme Format),
//                bordure pointillée permanente, survol = couleur de trait seule ;
//  · 'torn'    : « aperçu déchiré » — montre les portions du chapitre / du liminaire
//                ABSENTES du folio courant (premiers styles enchaînés en col. 1, un
//                échantillon par style restant en col. 2).
// Format garde son rendu propre (pas de sélecteur).
const MODES = [
  { value: 'default', label: 'Par défaut' },
  { value: 'torn', label: 'Aperçu déchiré' },
]

export function usePresentationMode({ focusedSourceKey }) {
  const mode = ref('default')

  const showPresentationSelect = computed(() => {
    const s = focusedSourceKey.value
    return s === 'liminaire' || s === 'chapitrage'
  })

  // Hors Liminaire/Chapitrage, la source impose son propre rendu : on neutralise le
  // mode pour ne pas fuiter 'torn' sur Format / recherche / validation. Le choix reste
  // mémorisé dans `mode` et repris au retour sur un jalon éligible.
  const presentationMode = computed(() => (showPresentationSelect.value ? mode.value : 'default'))

  function setPresentationMode(v) {
    mode.value = v
  }

  return {
    presentationMode,
    availableModes: computed(() => MODES),
    showPresentationSelect,
    setPresentationMode,
  }
}
