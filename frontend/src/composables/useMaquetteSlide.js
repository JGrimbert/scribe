import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'

// Durée du glissement (px → 100% d'un slot). Réglage à l'œil.
const SLIDE_MS = 550

// Slide à DEUX planches entre deux vues de la maquette. Chaque vue est une FolioView à
// part entière (paged + sa trame en `bg-scope="local"`) ET, pour les vues frag, une scène
// en regard (nuage / validation). Le slide fige la vue SORTANTE le temps du glissement et
// fait entrer la nouvelle (ping-pong de deux slots A/B), planche ET scène solidaires.
//
// Une « vue » = `{ bundle, scene }` : `bundle` = les props FolioView ; `scene` = ce dont
// l'aside frag a besoin (`kind` 'analyse'|'validation'|null, `isCloudView`…). On fige tout
// ensemble → l'aside sortant garde son contenu pendant qu'il glisse dehors.
//
// AXE selon la vue : les vues FRAG (repérées par `bundle.barePages`) glissent en VERTICAL
// et occupent le bord HAUT (descendent du haut à l'entrée, remontent à la sortie ; l'autre
// vue vient/part par le bas). Les autres bascules glissent en HORIZONTAL.
export function useMaquetteSlide({ focused, liveView, markSettled }) {
  const liveSlot = ref('a')                  // slot lié à liveView (la vue courante)
  const frozenView = ref(null)               // vue SORTANTE figée { bundle, scene } — non nulle pendant un slide
  const shift = ref({ axis: 'x', a: 0, b: 0 }) // axe + décalage par slot, en unités d'écran (-1/0/1)
  const sliding = ref(false)                 // transition CSS active
  const emitToken = ref(0)                   // bump → la planche vivante ré-émet sa géométrie au repos

  let pendingIncoming = null
  let pendingSlide = null                    // { axis, outgoing, incoming, outEnd } fixé à la bascule
  let slideTimer = null
  const other = (s) => (s === 'a' ? 'b' : 'a')
  const isFrag = (v) => !!v?.bundle?.barePages

  // Vue / bundle d'un slot : le slot vivant suit liveView, l'autre porte la vue figée (ou
  // rien → le slot ne se monte pas, cf. le `v-if` côté template).
  const viewFor = (slot) => (liveSlot.value === slot ? liveView.value : frozenView.value)
  const bundleFor = (slot) => viewFor(slot)?.bundle
  // Descriptif de callouts du slot : figé pour la vue sortante, live pour l'entrante —
  // l'overlay de callouts glisse ainsi avec la planche de SON slot.
  const calloutsFor = (slot) => viewFor(slot)?.callouts

  // prevView : la valeur PRÉCÉDENTE de liveView — la vue à l'écran quand une bascule
  // survient. Ce watch est déclaré AVANT celui de `focused` : même flush, ordre de
  // création → `prevView` porte déjà l'ancienne vue quand la bascule est traitée.
  let prevView = liveView.value
  watch(liveView, (n, o) => { prevView = o })

  watch(focused, (n, o) => {
    if (pendingIncoming) finalize()          // un slide déjà en cours : le clore d'abord (throttlé)
    const outgoing = liveSlot.value
    const incoming = other(outgoing)
    const incomingFrag = isFrag(liveView.value)
    const outgoingFrag = isFrag(prevView)
    const back = n < o                       // reculer dans la liste des jalons

    // Axe + positions de départ/arrivée. HORIZONTAL par défaut : en marche avant l'entrante
    // vient de la DROITE et la sortante file à GAUCHE ; en marche arrière, sens inversé.
    let axis = 'x'
    let inStart = back ? -1 : 1              // entrante : +1 (droite) avant, -1 (gauche) arrière
    let outEnd = back ? 1 : -1              // sortante : -1 (gauche) avant, +1 (droite) arrière
    if (incomingFrag || outgoingFrag) {
      axis = 'y'
      if (incomingFrag) { inStart = -1; outEnd = 1 }  // frag descend du HAUT ; sortante file en BAS
      else { inStart = 1; outEnd = -1 }               // frag sortante remonte en HAUT ; entrante vient du BAS
    }

    frozenView.value = prevView              // la sortante garde la vue d'AVANT la bascule (figée)
    shift.value = { axis, [outgoing]: 0, [incoming]: inStart }
    sliding.value = false
    liveSlot.value = incoming                // l'entrante se lie à liveView (nouvelle vue) et pagine
    pendingIncoming = incoming
    pendingSlide = { axis, outgoing, incoming, outEnd }
  })

  // Une planche vient de paginer.
  function onSlotPaginated(slot) {
    if (slot !== liveSlot.value) return                     // planche figée (sortante) : ignorer
    if (pendingIncoming !== slot) { markSettled(); return } // repagination interne (pager, style)
    const { axis, outgoing, incoming, outEnd } = pendingSlide
    // Deux frames pour peindre le placement initial (entrante hors champ) avant d'animer,
    // sinon le navigateur fusionne les deux styles et rien ne glisse.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sliding.value = true
      shift.value = { axis, [outgoing]: outEnd, [incoming]: 0 }
    }))
    clearTimeout(slideTimer)
    slideTimer = setTimeout(finalize, SLIDE_MS)
  }

  function finalize() {
    clearTimeout(slideTimer)
    if (!pendingIncoming) return
    pendingIncoming = null
    sliding.value = false
    frozenView.value = null                  // démonte la planche + la scène sortantes
    shift.value = { axis: 'x', a: 0, b: 0 }
    // L'entrante est à sa place (shift 0) mais sa géométrie a été émise hors champ : on la
    // fait ré-émettre au repos, PUIS on signale « posé » (scènes/callouts se composent).
    nextTick(() => { emitToken.value++; markSettled() })
  }

  onBeforeUnmount(() => clearTimeout(slideTimer))

  const shiftStyle = (slot) => {
    const s = shift.value
    const v = (s[slot] ?? 0) * 100
    return {
      transform: s.axis === 'y' ? `translateY(${v}%)` : `translateX(${v}%)`,
      transition: sliding.value ? `transform ${SLIDE_MS}ms ease` : 'none',
    }
  }

  // Aside frag À AFFICHER + son transform de glissement : la vue frag VIVANTE en priorité
  // (entrée / repos), sinon la frag SORTANTE (le temps qu'elle glisse dehors). Null hors
  // vue frag. `scene` porte le contenu (figé pour la sortante), `style` mirroir du slot.
  const fragScene = computed(() => {
    if (isFrag(liveView.value)) return { scene: liveView.value.scene, style: shiftStyle(liveSlot.value) }
    const fz = frozenView.value
    if (fz && isFrag(fz)) return { scene: fz.scene, style: shiftStyle(other(liveSlot.value)) }
    return null
  })

  return { liveSlot, bundleFor, calloutsFor, onSlotPaginated, shiftStyle, emitToken, fragScene }
}
