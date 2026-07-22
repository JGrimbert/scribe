import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { groupLiminairePages } from '../script/liminaire-pages'
import { absorbableCount, extendedLiminaire, nextNodeTitle } from '../script/liminaire-bornes'

// Déplacement LOCAL de la borne de fin du liminaire, en nombre de nœuds
// absorbés. Une PRÉVISUALISATION : tant qu'il n'est pas nul, la configuration ne
// peut pas être enregistrée telle quelle — seul un recalibrage déplace la borne
// pour de bon (cf. script/liminaire-bornes).
//
// `trame`/`documentData` sont les injections de DocumentLayout (ref|null) ;
// `liminaireConfig` est le reactive de useTypologyConfig, passé TEL QUEL à
// groupLiminairePages (pas de `.value`) — fusionner/scinder une page recompose
// le découpage dans le même tick.
export function useLiminaireBornes(trame, documentData, liminaireConfig) {
  const route = useRoute()
  const borderShift = ref(0)

  // Repartir de zéro en changeant de document : le décalage porte sur CE
  // liminaire-ci, pas sur le suivant.
  watch(() => route.params.id, () => { borderShift.value = 0 })

  const extendedEntries = computed(() =>
    extendedLiminaire(trame?.value?.liminaire ?? [], trame?.value?.axes ?? [], documentData?.value ?? {}, borderShift.value),
  )

  const canExtend = computed(
    () => borderShift.value < absorbableCount(trame?.value?.axes ?? [], documentData?.value ?? {}),
  )

  const nextTitle = computed(() =>
    nextNodeTitle(trame?.value?.axes ?? [], documentData?.value ?? {}, borderShift.value),
  )

  const liminairePages = computed(() => groupLiminairePages(extendedEntries.value, liminaireConfig))

  return { borderShift, canExtend, nextTitle, liminairePages }
}
