import { ref } from 'vue'

// Gouttières horizontales de la trame, en multiples de la gouttière verticale V
// (une seule unité pour toute la trame) : bande de TÊTE = V, bande de PIED = 2·V —
// l'asymétrie tête/pied d'une page imprimée. (Auparavant une bande unique symétrique
// de 2,5·V, ROW_GUTTER_RATIO.) Entre deux rangs, un LISERET de 6·V s'insère APRÈS le
// pied et AVANT la tête suivante : la trame respire au lieu d'enchaîner directement
// sur le rang du dessous.
const TOP_GUTTER_RATIO = 1
const BOTTOM_GUTTER_RATIO = 2
const LISERET_RATIO = 6

// Géométrie de la planche (mode spread) : lit les rects des pages dans l'iframe,
// ÉMET le contrat de FolioView (`spread-/block-/style-geometry`) et produit le sac de
// variables de la trame de fond (peinte par FolioSpreadBackground). Sorti de FolioView
// pour l'alléger : ici la géométrie, là-bas le câblage ; la présentation (élément +
// CSS des dégradés) vit dans le composant dédié.
//
// `bgVars` : null quand aucune page (fond caché), sinon les cotes scalées de la trame
// (période/gouttière/phase par axe). `updateSpreadBg` est rappelé à chaque onScaled /
// onResized / onPaginated / défilement molette (cf. FolioView).
export function useFolioSpreadGeometry(props, { frameRef, frameDoc, padRef, scaleRef, animating, emit }) {
  const bgVars = ref(null)

  function updateSpreadBg() {
    if (props.mode !== 'spread') return
    const doc = frameDoc()
    const frame = frameRef.value
    if (!doc || !frame) return
    const pages = doc.querySelectorAll('.pagedjs_page')
    if (!pages.length) {
      bgVars.value = null
      emit('spread-geometry', null)
      emit('block-geometry', [])
      emit('style-geometry', {})
      return
    }
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
    // `period` accompagne les rects : c'est la COLONNE de la trame, l'unité dans
    // laquelle l'appelant range ce qu'il pose à côté de la planche (cf. la scène de
    // recherche de la maquette, qui s'y réserve une colonne).
    // Émis à chaque mesure — repagination, échelle (onScaled), molette (onFrameWheel).
    // `animating` : la planche est en train de GLISSER (dézoom, décalage de colonne).
    // Les rects sont justes mais transitoires — l'appelant qui compose une scène
    // par-dessus (cf. la recherche de la maquette) attend qu'il retombe.
    const fr = frame.getBoundingClientRect()
    emit('spread-geometry', {
      period: pagePeriod,
      gutter,
      animating: animating.value,
      pages: Array.from(pages).map((p) => {
        const r = p.getBoundingClientRect()
        return { left: r.left + fr.left, top: r.top + fr.top, width: r.width, height: r.height }
      }),
    })
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
    emit('block-geometry', blocks)
    // Rects ÉCRAN de la PREMIÈRE occurrence VISIBLE de chaque style (`data-style`) :
    // les callouts de styles (liminaire/chapitrage) y ancrent leur fuyante. On saute
    // les pages MASQUÉES (`.folio-hidden` du cap : leur contenu est hors scope) ;
    // l'ordre du DOM = ordre de lecture, donc la 1re occurrence rencontrée fait foi.
    const seenStyles = new Set()
    const styleRects = {}
    doc.querySelectorAll('.pagedjs_page:not(.folio-hidden) [data-style]').forEach((el) => {
      const name = el.getAttribute('data-style')
      if (seenStyles.has(name)) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      seenStyles.add(name)
      styleRects[name] = { left: r.left + fr.left, top: r.top + fr.top, width: r.width, height: r.height }
    })
    emit('style-geometry', styleRects)
    // Le rect des pages est intra-iframe : seule la phase traverse la frontière
    // iframe↔écran, d'où frameRect (qui porte aussi le SPREAD_PAD réservé dedans).
    const frameRect = frame.getBoundingClientRect()
    // Origine des phases : la fenêtre (trame `fixed`) ou le bord du wrapper des
    // pages (trame `local`, bornée à cette planche — cf. bgScope).
    const padRect = props.bgScope === 'local' ? padRef.value?.getBoundingClientRect() : null
    const originX = padRect?.left ?? 0
    const originY = padRect?.top ?? 0
    // Pavage horizontal de la trame (X). gutter/period/phaseRight calculés plus haut
    // (émis avec la géométrie). Deux régimes :
    //  · ACCOLÉ (défaut) : l'unité pavée est la PLANCHE (2 pages qui se touchent).
    //    La gouttière dessinée est celle ENTRE planches ; les filets tombent sur les
    //    bords EXTÉRIEURS de chaque planche, et la reliure centrale n'en porte plus
    //    — les deux pages se lisent comme une seule. Période = planche + gouttière,
    //    phase = bord extérieur DROIT de la planche.
    //  · HISTORIQUE : l'unité est la PAGE, la gouttière celle entre deux pages, la
    //    phase le bord droit de la page — chaque page cernée, reliure comprise.
    // Gouttières Y (tête/pied) : même unité V que X, mais ASYMÉTRIQUES — tête = V,
    // pied = 2·V (cf. TOP/BOTTOM_GUTTER_RATIO), séparées entre rangs par un LISERET de
    // 6·V. La période Y court d'un haut de page au suivant (page + pied + liseret + tête)
    // et la phase se cale sur le HAUT de page : le gradient `::after` pose quatre filets,
    // la planche unique montre V au-dessus et 2·V dessous.
    const topGutterY = gutter * TOP_GUTTER_RATIO
    const bottomGutterY = gutter * BOTTOM_GUTTER_RATIO
    const liseretY = gutter * LISERET_RATIO
    bgVars.value = {
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
  }

  return { bgVars, updateSpreadBg }
}
