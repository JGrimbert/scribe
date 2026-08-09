import { inject, watch, watchEffect, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Synchro `focused` ⇄ route + dernier maillon du fil d'Ariane. La route ne pin que le
// jalon ; `focused` reste la SoT interne. Deux watches gardés par un flag anti-boucle.
// Composable à effets (ne retourne rien).
export function useMaquetteRoute({ focused, crans, focusedCran, vocabIndex, limStart, limSpreads }) {
  const route = useRoute()
  const router = useRouter()
  const section = inject('documentSection', null)

  watchEffect(() => {
    if (!section) return
    const n = route.name
    if (n === 'maquette-format') section.value = 'Format'
    else if (n === 'maquette-liminaire') section.value = `Liminaire n°${Math.max(1, parseInt(route.params.n) || 1)}`
    else if (n === 'maquette-chapitrage') section.value = `Chapitrage n°${Math.max(1, parseInt(route.params.n) || 1)}`
    else if (n === 'maquette-annotations') section.value = 'Annotations'
    else section.value = null // titredulivre : hors fil d'Ariane
  })
  onUnmounted(() => { if (section) section.value = null })

  let syncing = false

  function routeTarget() {
    const n = route.name
    const idx = Math.max(0, (parseInt(route.params.n) || 1) - 1)
    if (n === 'maquette-format') return { key: 'format' }
    if (n === 'maquette-liminaire') return { key: 'liminaire', local: idx }
    if (n === 'maquette-chapitrage') return { key: `chap-${idx}` }
    if (n === 'maquette-annotations') return { key: 'validation' }
    return { key: 'vocabulaire' }
  }

  function locationForCran(cran) {
    const id = route.params.id
    const k = cran?.seriesKey
    if (k === 'format') return { name: 'maquette-format', params: { id } }
    if (k === 'liminaire') return { name: 'maquette-liminaire', params: { id, n: String(Math.max(0, focused.value - limStart.value) + 1) } }
    if (k?.startsWith('chap-')) return { name: 'maquette-chapitrage', params: { id, n: String(Number(k.slice(5)) + 1) } }
    if (k === 'validation') return { name: 'maquette-annotations', params: { id } }
    return { name: 'maquette', params: { id } }
  }

  function sameJalon(loc) {
    if (loc.name !== route.name) return false
    return String(loc.params?.n ?? '') === String(route.params.n ?? '')
  }

  // route → focused. Tolère `crans` vide (fetch async) : re-tourne dès qu'il se peuple.
  watch(
    () => [route.name, route.params.n, crans.value.length],
    () => {
      if (syncing) return
      const t = routeTarget()
      const cur = focusedCran.value
      if (cur?.seriesKey === t.key) {
        if (t.key !== 'liminaire') return
        if (focused.value - limStart.value === t.local) return
      }
      let idx = -1
      if (t.key === 'vocabulaire') idx = vocabIndex.value
      else if (t.key === 'liminaire') {
        const base = limStart.value
        idx = base < 0 ? -1 : base + Math.min(t.local, Math.max(0, limSpreads.value.length - 1))
      } else idx = crans.value.findIndex((c) => c.seriesKey === t.key)
      if (idx >= 0) {
        syncing = true
        focused.value = idx
        nextTick(() => { syncing = false })
      }
    },
    { immediate: true },
  )

  // focused → route (replace : la molette ne pollue pas l'historique).
  watch(focused, () => {
    if (syncing) return
    const loc = locationForCran(focusedCran.value)
    if (sameJalon(loc)) return
    syncing = true
    Promise.resolve(router.replace(loc)).catch(() => {}).finally(() => { syncing = false })
  })
}
