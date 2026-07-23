import { computed, ref } from 'vue'

// Le flux de recalibration des bornes du livre : ouverture de la modale, relecture
// du `.odt` d'origine (`POST /recalibrate`), et conservation du rapport rendu au
// commit. Les rechargements consécutifs (registre, trame/data, typologie) restent
// à l'hôte — ils touchent d'autres composables et n'appartiennent pas à ce flux.
//
// `docId` : ref|computed de l'id courant. `borderShift` : le décalage prévisualisé
// dans le composer, dont dépend la borne proposée à la calibration.
export function useRecalibration({ docId, borderShift }) {
  const preview = ref(null)
  const report = ref(null)
  // L'OUVERTURE de la modale, distincte de son contenu : elle s'affiche dès le
  // clic et porte elle-même l'attente. Sans ça, le clic restait sans effet
  // visible le temps que le backend relise le `.odt`.
  const recalOpen = ref(false)
  const starting = ref(false)
  const recalError = ref(null)

  // La borne à proposer dans la calibration : celle du document, AVANCÉE du
  // décalage prévisualisé dans le composer. C'est ce qui relie l'aperçu au
  // recalibrage — sans la borne courante rendue par le backend, on ne pouvait
  // qu'ouvrir la calibration sur une suggestion sans rapport avec le geste.
  const shiftedStartIndex = computed(() => {
    const current = preview.value?.currentStructureStartIndex
    if (current == null) return null
    return current + borderShift.value
  })

  function closeRecal() {
    recalOpen.value = false
    preview.value = null
    recalError.value = null
  }

  async function startRecalibration() {
    // La modale s'ouvre AVANT l'appel : elle est le lieu de l'attente, pas sa
    // récompense.
    recalOpen.value = true
    preview.value = null
    starting.value = true
    recalError.value = null
    report.value = null
    try {
      const res = await fetch(`/api/documents/${docId.value}/recalibrate`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message || `HTTP ${res.status}`)
      }
      preview.value = await res.json()
    } catch (e) {
      recalError.value = `Recalibration impossible : ${e.message}`
    } finally {
      starting.value = false
    }
  }

  // Commit réussi : on retient le rapport (affiché en en-tête, pas en toast — une
  // relecture perdue doit pouvoir se lire et se refaire) et on ferme. L'hôte
  // enchaîne les rechargements.
  function finishCommit(summary) {
    closeRecal()
    report.value = summary.recalibration ?? null
  }

  // Échap et clic sur le voile ferment : gérés par `UiModal` (hôte), qui émet
  // `close` → `closeRecal`. Pas de handler clavier ici, ce serait un doublon.

  return {
    preview, report, recalOpen, starting, recalError, shiftedStartIndex,
    startRecalibration, closeRecal, finishCommit,
  }
}
