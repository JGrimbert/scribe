import { computed, ref } from 'vue'
import { aggregateByDepth } from '../script/shapes'

/**
 * Les modèles de structure d'un document : les schémas récurrents par niveau.
 *
 * Le backend rend des STYLES (`GET /documents/:id/structure-shapes`), pas des
 * rôles. La traduction se fait ici, contre la typologie EN COURS D'ÉDITION :
 * chaque `BaseSelect` de l'écran modifie `styles`, et les modèles se
 * recomposent dans le même tick — on voit les motifs se former à mesure qu'on
 * typologise. Agréger côté serveur imposerait un aller-retour par rôle changé.
 *
 * @param styles  map réactive styleName → rôle (celle du formulaire de typologie)
 */
export function useStructureShapes(styles) {
  const shapes = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function load(documentId) {
    loading.value = true
    error.value = null
    shapes.value = []
    try {
      const res = await fetch(`/api/documents/${documentId}/structure-shapes`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      shapes.value = (await res.json()).shapes
    } catch (e) {
      error.value = `Impossible de charger les modèles de structure : ${e.message}`
    } finally {
      loading.value = false
    }
  }

  // Un style non encore arbitré n'a pas de rôle : « ? » plutôt que de le
  // rabattre sur « corps », qui ferait croire à une décision jamais prise.
  // Idem pour un paragraphe sans style (document importé avant leur relevé).
  const groups = computed(() => aggregateByDepth(shapes.value, (styleName) => styles[styleName] ?? '?'))

  return { shapes, groups, loading, error, load }
}
