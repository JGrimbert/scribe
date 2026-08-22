import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// Repli quand la gouttière n'est pas mesurable (planche incomplète ou géométrie pas
// encore émise) : le retrait des cartouches retombe alors sur cet écart fixe.
const GAP = 22

// Socle commun aux overlays de callouts posés SUR la planche du FolioView
// (MaquetteFormatCallouts = format ; MaquetteStyleCallouts = liminaire/chapitrage) :
// origine/boîte de l'overlay, géométrie de base de la planche (rails ferrés à 2·V du
// bord, décrochement vertical V/2), registre des lignes mesurables, tracé des fuyantes
// après rendu, et cycle
// ResizeObserver. Chaque hôte dérive sa géométrie propre de `baseGeo` et fournit son
// `buildLeaders`, exécuté après le nextTick de la mesure (DOM des lignes à jour).
//
// Paramètres :
//  · geometry : getter vers la prop `geometry` émise par FolioView ({ pages, gutter }).
//  · buildLeaders({ o, rowCenterY }) : renvoie le tableau des fuyantes à tracer (`o` =
//    origine de l'overlay ; `rowCenterY(key, oy)` = centre d'une ligne mesurée).
//  · watchSources : sources réactives supplémentaires [[getter, options?]] qui doivent
//    aussi relancer la mesure (géométrie de styles, cotes éditées en direct…).
export function useCalloutRig({ geometry, buildLeaders, watchSources = [] }) {
  const rootRef = ref(null)
  const origin = ref({ left: 0, top: 0 })
  const box = ref({ w: 0, h: 0 })
  const leaders = ref([])

  // Repères de la planche en coordonnées LOCALES de l'overlay + retrait unifié des
  // cartouches. `gut` = gouttière CENTRALE mesurée (repli GAP), gardée pour le coude des
  // fuyantes ; V (retrait) vient de `geometry().gutter` (émis, fiable — la gouttière
  // centrale vaut ~0 en vis-à-vis accolé).
  const baseGeo = computed(() => {
    const g = geometry()?.pages
    if (!g || g.length < 1) return null
    const o = origin.value
    const loc = (r) => ({
      left: r.left - o.left, top: r.top - o.top,
      right: r.left - o.left + r.width, bottom: r.top - o.top + r.height,
    })
    const recto = loc(g[0]) // page affichée à GAUCHE
    // Planche à page UNIQUE (chapitrage court tenant sur une page) : pas de verso →
    // on réutilise le recto. Sans ça, `g.length < 2` faisait tout bailler (geo null →
    // aucune row de style). midX retombe alors au centre de la page (verso=recto), le
    // rail droit se ferre à son bord droit : split gauche/droite et fuyantes OK.
    const verso = g.length > 1 ? loc(g[1]) : recto // page affichée à DROITE
    const centerGutter = verso.left - recto.right
    const gut = centerGutter > 0 ? centerGutter : GAP
    // Retraits des cartouches dérivés de V (gouttière verticale émise), IDENTIQUES
    // entre tous les jalons. DEUX valeurs, une par axe : l'éloignement HORIZONTAL des
    // piles (distance pile↔bord de page) est plus ample que le décrochement VERTICAL.
    const V = geometry()?.gutter ?? gut
    const railPad = V / 2 // décrochement VERTICAL (sous le haut / au-dessus du pied)
    const railGap = V * 2 // éloignement HORIZONTAL (rail ferré à 2·V du bord de page)
    return {
      recto, verso, gut, railPad,
      top: recto.top,
      leftRailX: recto.left - railGap,
      railX: verso.right + railGap,
    }
  })

  // Registre des lignes mesurables (clé → DOM) : chaque brique re-expose son élément via
  // `setRow` pour que sa fuyante parte de son centre.
  const rowEls = new Map()
  function setRow(key, el) {
    if (el) rowEls.set(key, el)
    else rowEls.delete(key)
  }
  // Ordonnée du centre d'une ligne (coords overlay), ou null si non montée.
  function rowCenterY(key, oy) {
    const el = rowEls.get(key)
    if (!el) return null
    const rr = el.getBoundingClientRect()
    return rr.top - oy + rr.height / 2
  }

  // Deux temps : poser l'origine/boîte (→ baseGeo + ancres de l'hôte recalculées), puis,
  // le DOM à jour, laisser l'hôte tracer ses fuyantes depuis les lignes mesurées.
  async function measure() {
    const root = rootRef.value
    if (!root) return
    const r = root.getBoundingClientRect()
    origin.value = { left: r.left, top: r.top }
    box.value = { w: r.width, h: r.height }

    await nextTick()
    leaders.value = buildLeaders({ o: origin.value, rowCenterY }) ?? []
  }

  let ro = null
  onMounted(() => {
    measure()
    ro = new ResizeObserver(measure)
    ro.observe(rootRef.value)
  })
  onBeforeUnmount(() => ro?.disconnect())

  watch(geometry, measure)
  for (const [source, opts] of watchSources) watch(source, measure, opts)

  return { rootRef, origin, box, baseGeo, leaders, setRow, measure }
}
