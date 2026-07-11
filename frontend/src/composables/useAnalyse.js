import { inject, onUnmounted, provide, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const KEY = Symbol('analyse-store')

export async function readJsonOrThrow(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
    throw new Error(message ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// Ordre de la relance globale ; les clés servent aussi d'identifiants de
// spinner par card (`running`) et d'erreurs par étape (`stepErrors`).
export const ANALYSE_STEPS = ['vocabulaire', 'lexical', 'semantic', 'topics']

const STEP_SUBPATHS = { vocabulaire: '', lexical: '/lexical', semantic: '/semantic' }

const POLL_INTERVAL_MS = 2500

// État partagé du dashboard d'analyse : AnalyseView appelle provideAnalyse(),
// chaque card consomme via useAnalyse(). `analysis` est l'objet complet renvoyé
// par le backend — chaque étape le remplace entièrement, d'où l'affichage
// progressif pendant la relance globale.
export function provideAnalyse() {
  const route = useRoute()
  const router = useRouter()

  const loading = ref(true)
  const error = ref(null)
  const analysis = ref(null)

  const running = ref(null) // clé de l'étape en cours, ou null
  const stepErrors = reactive(Object.fromEntries(ANALYSE_STEPS.map((s) => [s, null])))
  const topicsProgress = ref(null)

  // Coupe le polling topics si le dashboard est démonté en cours de route.
  let alive = true
  onUnmounted(() => {
    alive = false
  })

  async function fetchAnalysis() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/documents/${route.params.id}/analyse`)
      analysis.value = await readJsonOrThrow(res)
    } catch (e) {
      error.value = `Impossible de charger l'analyse : ${e.message}`
    } finally {
      loading.value = false
    }
  }

  async function recompute(sub) {
    const res = await fetch(`/api/documents/${route.params.id}/analyse${sub}`, { method: 'POST' })
    analysis.value = await readJsonOrThrow(res)
  }

  // Job asynchrone : POST → jobId, puis polling du statut jusqu'à done/error.
  async function runTopics() {
    topicsProgress.value = { pct: 0, step: 'démarrage' }
    try {
      const res = await fetch(`/api/documents/${route.params.id}/analyse/topics`, { method: 'POST' })
      const { jobId } = await readJsonOrThrow(res)

      while (alive) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        const statusRes = await fetch(`/api/documents/${route.params.id}/analyse/topics/jobs/${jobId}`)
        const status = await readJsonOrThrow(statusRes)
        topicsProgress.value = { pct: status.pct, step: status.step }
        if (status.status === 'error') throw new Error(status.error)
        if (status.status === 'done') {
          analysis.value = status.analysis
          break
        }
      }
    } finally {
      topicsProgress.value = null
    }
  }

  // Relance toutes les analyses en séquence. Une étape qui échoue n'arrête
  // pas les suivantes (le service NLP éteint doit laisser un message par
  // card concernée, pas masquer le reste).
  async function runAll() {
    if (running.value) return
    for (const step of ANALYSE_STEPS) {
      running.value = step
      stepErrors[step] = null
      try {
        if (step === 'topics') await runTopics()
        else await recompute(STEP_SUBPATHS[step])
      } catch (e) {
        stepErrors[step] = `Échec : ${e.message}`
      }
    }
    running.value = null
  }

  function goToNode(nodeId) {
    router.push(`/documents/${route.params.id}/noeud/${nodeId}`)
  }

  const store = {
    loading,
    error,
    analysis,
    running,
    stepErrors,
    topicsProgress,
    fetchAnalysis,
    runAll,
    goToNode,
  }
  provide(KEY, store)
  return store
}

export function useAnalyse() {
  return inject(KEY)
}
