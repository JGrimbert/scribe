import { ref, onBeforeUnmount } from 'vue'

// Gouttières horizontales de la trame, en multiples de la gouttière verticale V
// (une seule unité pour toute la trame) : bande de TÊTE = V, bande de PIED = 2·V —
// l'asymétrie tête/pied d'une page imprimée. (Auparavant une bande unique symétrique
// de 2,5·V, ROW_GUTTER_RATIO.) Entre deux rangs, un LISERET de 6·V s'insère APRÈS le
// pied et AVANT la tête suivante : la trame respire au lieu d'enchaîner directement
// sur le rang du dessous.
const TOP_GUTTER_RATIO = 1
const BOTTOM_GUTTER_RATIO = 2
const LISERET_RATIO = 6

// Durée du glissement de trame (filmstrip). À garder synchro avec la transition CSS de
// FolioSpreadBackground.
const SLIDE_MS = 320

// Géométrie de la planche (mode spread) : lit les rects des pages dans l'iframe,
// ÉMET le contrat de FolioView (`spread-/block-/style-geometry`) et produit le sac de
// variables de la trame de fond (peinte par FolioSpreadBackground). Sorti de FolioView
// pour l'alléger : ici la géométrie, là-bas le câblage ; la présentation (élément +
// CSS des dégradés) vit dans le composant dédié.
//
// `bgVars` : null quand aucune page (fond caché), sinon les cotes scalées de la trame
// (période/gouttière/phase par axe). `updateSpreadBg` est rappelé à chaque onScaled /
// onResized / onPaginated / défilement molette (cf. FolioView).
//
// FILMSTRIP (`runSlide`) : à une bascule de vue, la trame ne saute pas — l'ancienne
// couche glisse vers la gauche pendant que la nouvelle entre par la droite. D'où DEUX
// jeux de vars (`bgVars` entrante, `bgVarsOut` sortante) et deux décalages (`inShift`/
// `outShift`) posés en transform sur chaque couche.
export function useFolioSpreadGeometry(props, { frameRef, frameDoc, padRef, scaleRef, animating, emit }) {
  const bgVars = ref(null)
  // Couche SORTANTE (snapshot de l'ancienne trame) + décalages des deux couches (px) et
  // drapeau d'animation (transition CSS active seulement pendant le glissement).
  const bgVarsOut = ref(null)
  const inShift = ref(0)
  const outShift = ref(0)
  const slideAnimated = ref(false)
  // Rects de PAGE (coords fenêtre) des deux couches : le volume « crème + croix » (le
  // footprint des pages, révélé pendant le creux) s'y ancre et glisse avec la trame.
  const bgPages = ref(null)
  const bgPagesOut = ref(null)

  // Lit la géométrie courante dans le DOM de l'iframe. Retourne :
  //  · undefined — iframe pas prête (ne rien toucher) ;
  //  · null — aucune page (trame vide) ;
  //  · { spread, blocks, styles, bgVars } — les cotes à émettre / peindre.
  // Ne MUTE rien : l'application (set bgVars + emits) est faite par `applyGeometry`,
  // pour que `runSlide` puisse peindre la nouvelle trame sans émettre tout de suite.
  function computeGeometry() {
    const doc = frameDoc()
    const frame = frameRef.value
    if (!doc || !frame) return undefined
    const pages = doc.querySelectorAll('.pagedjs_page')
    if (!pages.length) return null

    const first = pages[0]
    const r0 = first.getBoundingClientRect()
    // Empreinte d'UNE page (colonne de trame) : page + ses marges, mise à l'échelle.
    // C'est ce qu'on ÉMET aux callers (réserve de colonne de la recherche, pas de
    // `columnShift`) — la colonne, indépendante de l'accolage. Le pavage VISUEL de
    // la trame, lui, se cale sur la PLANCHE quand les pages sont accolées (cf. plus
    // bas). Calculée depuis les marges de la page plutôt que d'un écart page-à-page :
    // accolées, deux pages qui se font face se touchent (l'écart mesuré vaudrait la
    // seule largeur de page). `getComputedStyle` rend une valeur de MISE EN PAGE
    // (avant transform), d'où le produit par l'échelle ; un getBoundingClientRect
    // est déjà scalé.
    const cs0 = doc.defaultView.getComputedStyle(first)
    const pagePeriod = r0.width
      + ((parseFloat(cs0.marginLeft) || 0) + (parseFloat(cs0.marginRight) || 0)) * scaleRef.value
    // Gouttière verticale V et pavage X, selon le régime d'accolage (rendu détaillé
    // plus bas). Calculés ICI pour être émis avec la géométrie : les callouts s'en
    // servent comme UNITÉ (padding des cartouches de cote) — la gouttière qu'ils
    // mesureraient au centre du vis-à-vis vaut ~0 en accolé, ce n'est pas V.
    let gutter, period, phaseRight
    if (props.contiguousSpread) {
      const second = pages[1] ?? null
      const r1 = second ? second.getBoundingClientRect() : r0
      const cs1 = second ? doc.defaultView.getComputedStyle(second) : cs0
      // Gouttière inter-planche = somme des marges EXTÉRIEURES de deux pages en regard.
      // Chaque page a sa reliure (côté intérieur) à 0 → la marge extérieure est la PLUS
      // GRANDE des deux marges inline. Avec une seule page rendue (cs1 = cs0) on double
      // ainsi la marge extérieure au lieu de retomber sur une demi-gouttière : V reste
      // identique que le flow produise 1 ou 2 pages (pas de disparité entre modes).
      const outer = (cs) => Math.max(parseFloat(cs.marginLeft) || 0, parseFloat(cs.marginRight) || 0)
      gutter = (outer(cs0) + outer(cs1)) * scaleRef.value
      period = (r1.right - r0.left) + gutter
      phaseRight = r1.right
    } else {
      gutter = pagePeriod - r0.width
      period = pagePeriod
      phaseRight = r0.left + r0.width
    }
    // Rects ÉCRAN des pages : les callouts de format s'y ancrent (cf. formatAnchors
    // + MaquetteFormatCallouts). Les pages vivent DANS l'iframe → leur rect est
    // relatif au viewport de l'iframe ; on ajoute l'offset écran de la frame pour
    // le ramener en coordonnées fenêtre (même correction que la trame ci-dessous).
    const fr = frame.getBoundingClientRect()
    const spread = {
      period: pagePeriod,
      gutter,
      animating: animating.value,
      pages: Array.from(pages).map((p) => {
        const r = p.getBoundingClientRect()
        // Rect de l'EMPAGEMENT (zone de contenu, marges déduites) en coords fenêtre :
        // la croix de transition s'y ancre (coins opposés des gouttières intérieures).
        const c = p.querySelector('.pagedjs_page_content')?.getBoundingClientRect()
        return {
          left: r.left + fr.left, top: r.top + fr.top, width: r.width, height: r.height,
          content: c ? { left: c.left + fr.left, top: c.top + fr.top, width: c.width, height: c.height } : null,
        }
      }),
    }
    // Rects ÉCRAN des blocs d'imposition PORTEURS d'une clé d'entrée (`data-entry-key`,
    // stampée par buildImpositionBlocks pour le liminaire) : l'overlay liminaire y
    // ancre ses contrôles de découpage en marge. Une entrée coupée entre deux pages
    // rend plusieurs fragments qui gardent la clé — on ne garde que le PREMIER (le
    // début de l'entrée). Coords fenêtre, comme les pages.
    const seenKeys = new Set()
    const blocks = []
    doc.querySelectorAll('.pagedjs_page [data-entry-key]').forEach((el) => {
      const key = el.getAttribute('data-entry-key')
      if (seenKeys.has(key)) return
      seenKeys.add(key)
      const r = el.getBoundingClientRect()
      blocks.push({ key, left: r.left + fr.left, top: r.top + fr.top, width: r.width, height: r.height })
    })
    // Rects ÉCRAN de la PREMIÈRE occurrence VISIBLE de chaque style (`data-style`) :
    // les callouts de styles (liminaire/chapitrage) y ancrent leur fuyante. On saute
    // les pages MASQUÉES (`.folio-hidden` du cap : leur contenu est hors scope) ;
    // l'ordre du DOM = ordre de lecture, donc la 1re occurrence rencontrée fait foi.
    const seenStyles = new Set()
    const styles = {}
    doc.querySelectorAll('.pagedjs_page:not(.folio-hidden) [data-style]').forEach((el) => {
      const name = el.getAttribute('data-style')
      if (seenStyles.has(name)) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      seenStyles.add(name)
      styles[name] = { left: r.left + fr.left, top: r.top + fr.top, width: r.width, height: r.height }
    })
    // Le rect des pages est intra-iframe : seule la phase traverse la frontière
    // iframe↔écran, d'où frameRect (qui porte aussi le SPREAD_PAD réservé dedans).
    const frameRect = frame.getBoundingClientRect()
    // Origine des phases : la fenêtre (trame `fixed`) ou le bord du wrapper des
    // pages (trame `local`, bornée à cette planche — cf. bgScope).
    const padRect = props.bgScope === 'local' ? padRef.value?.getBoundingClientRect() : null
    const originX = padRect?.left ?? 0
    const originY = padRect?.top ?? 0
    // Pavage horizontal de la trame (X). gutter/period/phaseRight calculés plus haut.
    // Deux régimes : ACCOLÉ (planche = unité) / HISTORIQUE (page = unité). Gouttières Y
    // (tête/pied) : même unité V que X, mais ASYMÉTRIQUES — tête = V, pied = 2·V,
    // séparées entre rangs par un LISERET de 6·V.
    const topGutterY = gutter * TOP_GUTTER_RATIO
    const bottomGutterY = gutter * BOTTOM_GUTTER_RATIO
    const liseretY = gutter * LISERET_RATIO
    const nextBgVars = {
      gutter,
      period,
      phase: phaseRight + frameRect.left - originX,
      pageH: r0.height,
      gutterTop: topGutterY,
      gutterBottom: bottomGutterY,
      liseret: liseretY,
      periodY: r0.height + topGutterY + bottomGutterY + liseretY,
      phaseY: r0.top + frameRect.top - originY,
    }
    return { spread, blocks, styles, bgVars: nextBgVars }
  }

  // Applique une géométrie calculée : peint la trame (entrante) et émet le contrat.
  function applyGeometry(g) {
    if (g === undefined) return
    if (g === null) {
      bgVars.value = null
      bgPages.value = null
      emit('spread-geometry', null)
      emit('block-geometry', [])
      emit('style-geometry', {})
      return
    }
    bgVars.value = g.bgVars
    bgPages.value = g.spread.pages
    emit('spread-geometry', g.spread)
    emit('block-geometry', g.blocks)
    emit('style-geometry', g.styles)
  }

  function updateSpreadBg() {
    if (props.mode !== 'spread') return
    applyGeometry(computeGeometry())
  }

  // Glissement filmstrip : l'ancienne trame sort par la gauche, la nouvelle entre par la
  // droite (un écran de large). `onDone` (→ `emit('paginated')`) n'est appelé qu'à la
  // FIN — la coquille ne révèle les pages qu'une fois le glissement posé.
  let slideTimer = null
  function runSlide(onDone) {
    const g = computeGeometry()
    if (!g) { applyGeometry(g); onDone(); return }
    // Snapshot de la trame + des pages courantes AVANT de les remplacer : couche sortante.
    bgVarsOut.value = bgVars.value
    bgPagesOut.value = bgPages.value
    applyGeometry(g)                 // la couche entrante peint la nouvelle trame + émet
    const W = window.innerWidth
    // Placement initial SANS transition : entrante hors écran à droite, sortante en place.
    slideAnimated.value = false
    inShift.value = W
    outShift.value = 0
    // Deux frames pour que ce placement se peigne avant d'armer la transition, sinon le
    // navigateur fusionne les deux styles et rien ne glisse.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      slideAnimated.value = true
      inShift.value = 0                // entrante → en place
      outShift.value = -W              // sortante → hors écran à gauche
    }))
    clearTimeout(slideTimer)
    slideTimer = setTimeout(() => {
      slideAnimated.value = false
      bgVarsOut.value = null           // retire la couche sortante
      bgPagesOut.value = null
      inShift.value = 0
      outShift.value = 0
      onDone()
    }, SLIDE_MS)
  }

  onBeforeUnmount(() => clearTimeout(slideTimer))

  return {
    bgVars, bgVarsOut, bgPages, bgPagesOut,
    inShift, outShift, slideAnimated, updateSpreadBg, runSlide,
  }
}
