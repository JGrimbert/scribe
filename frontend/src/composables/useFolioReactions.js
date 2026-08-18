import { watch, onBeforeUnmount, nextTick } from 'vue'

// Réactions de FolioView aux changements de props : ce qui repagine, ce qui recale
// l'échelle, ce qui ne fait que réécrire une feuille. Extrait de FolioView pour
// l'alléger ; la mécanique (frame, échelle, surlignage) vit dans les composables
// qu'on reçoit ici en injection.
//
// Reçoit `frameRef` (pour savoir si l'iframe est prête) + les actions des autres
// composables : `refresh` (repagination), `fitScale`/`animateScale` (échelle, sèche
// ou glissée), `applyHighlight` (feuille de surlignage en place).
export function useFolioReactions(props, { frameRef, refresh, fitScale, animateScale, applyHighlight }) {
  let styleTimer = null
  // Vrai le temps du tick d'une repagination STRUCTURELLE : la passe de style, qui
  // se déclenche au même tick quand on change de cran (le gabarit change avec la
  // structure), s'y efface — cf. son watch plus bas.
  let structuralTick = false

  // Changement de nœud/niveau : repagine. L'édition, elle, repagine via refresh()
  // (appelé par useFragmentEditor) — pas besoin d'observer le contenu ici, ce qui
  // éviterait de repaginer deux fois après une frappe.
  watch(() => [props.nodeId, props.depth, props.spreadPages, props.bodyCross, props.barePages, props.clampEntries, props.capPages], () => {
    structuralTick = true
    nextTick(() => { structuralTick = false })
    clearTimeout(styleTimer)
    refresh()
  })

  // Nombre de pages visées dans la largeur : c'est le ZOOM. Rien à repaginer — mais
  // `fitScale` n'est rappelé que par le ResizeObserver (la racine ne bouge pas) ou
  // une repagination, d'où ce rappel explicite (le dézoom de la maquette ne change
  // que cette prop). GLISSÉ (et non `fitScale` sec) : c'est le seul changement
  // d'échelle demandé par l'utilisateur, il doit se voir se faire.
  // MAIS pas quand la vue change (`structuralTick`) : `visible-pages` bascule alors en
  // même temps que la page (ex. entrée en recherche : A5 → page large). Glisser ici
  // rescalerait sur l'ANCIENNE page encore rendue (double-buffer) → l'échelle grossit
  // puis revient une fois la repagination faite. `onPaginated` recale au bon état, en
  // une passe. L'échelle des vues frag étant calibrée sur celle du vis-à-vis, c'est
  // alors sans à-coup.
  watch(() => props.visiblePages, () => { if (!structuralTick) animateScale() })

  // La réserve latérale entre dans le calcul d'échelle sans rien repaginer : même
  // rappel explicite, mais sec — elle change quand la vue change de nature
  // (recherche), pas sur un geste de zoom à faire voir. Même garde structurelle :
  // `side-rails` bascule avec la vue, la repagination rescalera.
  watch(() => props.sideRails, () => { if (!structuralTick) fitScale() })

  // Décalage de colonne : GLISSÉ comme le dézoom — c'est le mouvement qu'on vient
  // regarder (l'entrée dans la recherche). La boucle rAF d'`animateScale` rappelle
  // `onResized` à chaque frame : trame de fond et géométrie émise (donc le nuage,
  // qui se cale dessus) accompagnent la planche au lieu de sauter à l'arrivée.
  watch(() => props.columnShift, animateScale)

  // Surlignage : SURTOUT PAS dans le watch ci-dessus. Il change à chaque ligne
  // survolée dans l'aside — on réécrit une feuille en place, rien à repaginer.
  watch(() => props.highlightStyle, applyHighlight)

  // Changement d'apparence/césure (aperçu de config édité en direct) : repagine, mais
  // DÉBOUNCÉ — la frappe dans un champ (corps, interligne) sinon repaginerait à chaque
  // caractère, sur jusqu'à 3 iframes. `props.visuals` est un nouvel objet à chaque
  // retouche (cf. effectiveVisuals), une comparaison de référence suffit.
  // `hyphenation.global` explicitement : dans la config il est muté EN PLACE (même
  // référence d'objet), une comparaison de l'objet seul le raterait.
  // `props.page` : nouvel objet à chaque changement de format (cf. previewPage,
  // ConfigView) — même comparaison de référence que visuals. `runningTitles` est
  // muté EN PLACE dans la config (comme hyphenation) : on surveille ses champs.
  watch(() => [
    props.visuals, props.hyphenation, props.hyphenation?.global, props.page, props.margins,
    props.runningTitles, runningTitlesSignature(props.runningTitles), props.bookTitle,
  ], () => {
    if (!frameReadyForStyle()) return
    // Changement de cran : la passe structurelle du même tick rend DÉJÀ avec ces
    // props. Sans ce garde, elle était suivie 250 ms plus tard d'une seconde
    // repagination — la planche se recalait en deux temps, à vue.
    if (structuralTick) return
    clearTimeout(styleTimer)
    styleTimer = setTimeout(refresh, 250)
  })
  onBeforeUnmount(() => clearTimeout(styleTimer))

  // Évite une repagination avant le premier rendu (buildFrame s'en charge déjà).
  function frameReadyForStyle() {
    return !!frameRef.value?.contentDocument
  }

  // Signature plate des titres courants : dans la config, `runningTitles` est muté
  // EN PLACE (nested), une comparaison de référence raterait les changements. On
  // sérialise les champs qui pilotent le rendu.
  function runningTitlesSignature(rt) {
    if (!rt) return ''
    const band = (b) => (b ? `${b.enabled}|${b.recto}|${b.verso}|${b.heightCm}|${b.justification}` : '')
    return `${band(rt.header)}#${band(rt.footer)}#${rt.folioFormat}`
  }
}
