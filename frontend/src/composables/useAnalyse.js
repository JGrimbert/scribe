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
// spinner par card (`running`) et d'erreurs par étape (`stepErrors`). Le
// nuage de mots (VocabulaireCard) est désormais une facette du volet lexical
// (lemmes spaCy filtrés par POS), il n'a plus d'étape propre.
export const ANALYSE_STEPS = ['lexical', 'semantic', 'topics']

const STEP_SUBPATHS = { lexical: '/lexical', semantic: '/semantic' }

const POLL_INTERVAL_MS = 2500

// Étapes du dashboard, dans l'ordre de révélation (= ordre DOM). `needs`
// désigne l'analyse backend dont dépend l'étape : sert au statut de la
// checklist (running/erreur/indisponible) et n'est PAS l'ordre de révélation.
export const DASHBOARD_STEPS = [
  { key: 'cloud', label: 'Fréquence', needs: 'lexical' },
  { key: 'occurrences', label: 'Occurrences', needs: 'lexical' },
  { key: 'semantique', label: 'Proximité', needs: 'semantic' },
  { key: 'lexical', label: 'Lexicale', needs: 'lexical' },
  { key: 'themes', label: 'Thématiques', needs: 'topics' },
  { key: 'pairs', label: 'Similarités', needs: 'semantic' },
]

const REVEAL_ORDER = DASHBOARD_STEPS.map((s) => s.key)
// Révélation en chaîne : chaque card signale `settle(key)` quand son entrée
// est jouée (layout posé, sélection faite) → la suivante apparaît après un
// léger stagger. Le fallback évite tout blocage si une card ne signale jamais
// (données absentes, erreur).
const REVEAL_STAGGER_MS = 320
const REVEAL_FALLBACK_MS = 1400

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

  // Sélection partagée entre les cards du haut : lemme choisi dans le nuage
  // (VocabulaireCard) → article focus (OccurrencesCard) → proximité
  // sémantique (SemantiqueCard). Centralisé ici plutôt que prop-drillé.
  const selectedLemma = ref(null) // { lemma, count, nodes[] } ou null
  const focusNodeId = ref(null) // nodeId de l'article focus, ou null

  // Orchestrateur de révélation séquentielle.
  const revealed = reactive(Object.fromEntries(REVEAL_ORDER.map((k) => [k, false])))
  const settling = ref(null) // étape révélée en attente de son signal, ou null
  // Étape qui « tourne » (spinner) : de sa révélation jusqu'à ce que la
  // suivante apparaisse — garantit un spinner visible avant la coche, même
  // pour les cards qui se posent instantanément.
  const revealActive = ref(null)
  const revealDone = ref(false) // chaîne de révélation terminée
  let fallbackTimer = null
  let staggerTimer = null

  // Coupe le polling topics et les timers de révélation si le dashboard est
  // démonté en cours de route.
  let alive = true
  onUnmounted(() => {
    alive = false
    clearTimeout(fallbackTimer)
    clearTimeout(staggerTimer)
  })

  function revealFrom(i) {
    if (i >= REVEAL_ORDER.length) {
      settling.value = null
      revealActive.value = null // la dernière étape passe en « done »
      revealDone.value = true
      return
    }
    const key = REVEAL_ORDER[i]
    revealed[key] = true
    revealActive.value = key
    settling.value = key
    clearTimeout(fallbackTimer)
    fallbackTimer = setTimeout(() => settle(key), REVEAL_FALLBACK_MS)
  }

  // Appelé par une card quand son entrée est jouée : enchaîne sur la suivante.
  function settle(key) {
    if (settling.value !== key) return
    clearTimeout(fallbackTimer)
    settling.value = null
    const i = REVEAL_ORDER.indexOf(key)
    clearTimeout(staggerTimer)
    staggerTimer = setTimeout(() => revealFrom(i + 1), REVEAL_STAGGER_MS)
  }

  function startReveal() {
    clearTimeout(fallbackTimer)
    clearTimeout(staggerTimer)
    revealDone.value = false
    revealActive.value = null
    for (const k of REVEAL_ORDER) revealed[k] = false
    revealFrom(0)
  }

  const isRevealed = (key) => revealed[key]

  // Statut d'une étape pour la checklist, réconciliant révélation initiale et
  // relance NLP : une analyse qui tourne prime, puis l'erreur, puis l'absence
  // de données, puis l'état de révélation.
  function stepStatus(step) {
    if (running.value === step.needs) return 'running'
    if (stepErrors[step.needs]) return 'error'
    if (!analysis.value?.[step.needs]) return 'unavailable'
    if (!revealed[step.key]) return 'pending'
    // Spinner tant que l'étape est l'« active » (jusqu'à révélation de la
    // suivante), puis coche.
    return revealActive.value === step.key ? 'running' : 'done'
  }

  async function fetchAnalysis() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/documents/${route.params.id}/analyse`)
      analysis.value = await readJsonOrThrow(res)
      startReveal()
      autoRunMissing() // non-awaité : révélation immédiate, calcul en tâche de fond
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

  async function executeStep(step) {
    stepErrors[step] = null
    try {
      if (step === 'topics') await runTopics()
      else await recompute(STEP_SUBPATHS[step])
    } catch (e) {
      stepErrors[step] = `Échec : ${e.message}`
    }
  }

  // Relance toutes les analyses en séquence. Une étape qui échoue n'arrête
  // pas les suivantes (le service NLP éteint doit laisser un message par
  // card concernée, pas masquer le reste).
  async function runAll() {
    if (running.value) return
    for (const step of ANALYSE_STEPS) {
      running.value = step
      await executeStep(step)
    }
    running.value = null
  }

  // Relance UNE analyse (ex : « Thèmes » resté indisponible). Même garde de
  // concurrence que runAll.
  async function runStep(step) {
    if (running.value) return
    running.value = step
    await executeStep(step)
    running.value = null
  }

  // Calcule automatiquement les analyses absentes au chargement (ex : thèmes
  // jamais lancés) — pas besoin du bouton manuel. On s'arrête à la première
  // erreur : si le service NLP est éteint, inutile d'insister sur les
  // suivantes (le bouton manuel reste disponible pour réessayer).
  async function autoRunMissing() {
    if (running.value) return
    const missing = ANALYSE_STEPS.filter((step) => !analysis.value?.[step])
    for (const step of missing) {
      running.value = step
      await executeStep(step)
      if (stepErrors[step]) break
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
    selectedLemma,
    focusNodeId,
    steps: DASHBOARD_STEPS,
    isRevealed,
    stepStatus,
    settle,
    revealDone,
    fetchAnalysis,
    runAll,
    runStep,
    goToNode,
  }
  provide(KEY, store)
  return store
}

export function useAnalyse() {
  return inject(KEY)
}
