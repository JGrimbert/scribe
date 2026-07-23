import { computed, ref } from 'vue'
import { aggregateByDepth } from '../script/shapes'

// Zone de modèle → profondeur des règles (0/1/2), miroir de DEPTH_BY_ZONE côté
// useTypologyConfig. Le seuil « au moins N caractères » d'un niveau écarte des
// modèles ses nœuds trop courts.
const DEPTH_BY_ZONE = { 'depth-0': 0, 'depth-1': 1, 'depth-2+': 2 }

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
 * @param rules   règles réactives { default, byDepth } : leur seuil « au moins N
 *                caractères » par niveau écarte des modèles les nœuds trop courts
 */
export function useStructureShapes(styles, rules) {
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

  // Seuil de caractères effectif d'un niveau : son jeu propre s'il existe, sinon
  // le défaut. Lu dans le computed → réactif (ajuster « au moins N » recompose
  // les modèles dans le même tick).
  function minCharsOfZone(zoneKey) {
    const set = rules?.byDepth?.[DEPTH_BY_ZONE[zoneKey]] ?? rules?.default
    return set?.minChars ?? null
  }

  // Un style non encore arbitré n'a pas de rôle : « ? » plutôt que de le
  // rabattre sur « corps », qui ferait croire à une décision jamais prise.
  // Idem pour un paragraphe sans style (document importé avant leur relevé).
  const groups = computed(() =>
    aggregateByDepth(shapes.value, (styleName) => styles[styleName] ?? '?', minCharsOfZone),
  )

  return { shapes, groups, loading, error, load }
}
