export function syncQuillToFragment({
                                        fragmentEl,
                                        quillWrapperEl,
                                        quillInnerEl,
                                        scale,
                                    }) {
    if (!fragmentEl || !quillWrapperEl || !quillInnerEl) return

    // Réalm du fragment : le document principal pour l'éditeur historique, celui
    // de l'iframe pour le rendu unifié. On dérive tout de là (aucune injection) :
    // `frameElement` donne l'iframe (null hors iframe → offset nul), et
    // `getComputedStyle` doit lire dans CE réalm.
    const win = fragmentEl.ownerDocument.defaultView
    const frameEl = win.frameElement
    const fo = frameEl ? frameEl.getBoundingClientRect() : { left: 0, top: 0 }

    // ---------------------------
    // 1. RECT POSITIONNEMENT
    // ---------------------------
    // `rect` est relatif au viewport du réalm du fragment (l'iframe) ; le wrapper
    // Quill est en `fixed` dans le body principal → on recale par la position
    // écran de l'iframe.
    const rect = fragmentEl.getBoundingClientRect()

    quillWrapperEl.style.position = 'fixed'
    quillWrapperEl.style.top = `${rect.top + fo.top}px`
    quillWrapperEl.style.left = `${rect.left + fo.left}px`
    quillWrapperEl.style.width = `${rect.width}px`
    quillWrapperEl.style.height = `${rect.height}px`
    quillWrapperEl.style.zIndex = 1000

    // ---------------------------
    // 2. HOMOTHÉTIE
    // ---------------------------
    // Le fragment Folio vit dans un conteneur `transform: scale(scale)` : son
    // getBoundingClientRect est DÉJÀ scalé (= W·scale), mais sa font-size
    // calculée ne l'est pas (les transforms n'affectent pas le layout). Pour que
    // Quill retourne à la ligne EXACTEMENT comme le Folio, on le met en page aux
    // métriques réelles du livre — largeur non scalée W = rect.width/scale, à la
    // même police — puis on le réduit par le MÊME `scale` que le Folio. Le ratio
    // largeur/police qui gouverne le wrapping devient identique (W/F).
    quillInnerEl.style.transformOrigin = 'top left'
    quillInnerEl.style.transform = `scale(${scale})`
    quillInnerEl.style.width = `${rect.width / scale}px`

    // ---------------------------
    // 3. TYPOGRAPHIE EXACTE
    // ---------------------------
    const style = win.getComputedStyle(fragmentEl)

    const fontSize = style.fontSize
    const lineHeight = style.lineHeight
    const fontFamily = style.fontFamily
    const letterSpacing = style.letterSpacing
    const padding = style.padding

    quillInnerEl.style.fontSize = fontSize
    quillInnerEl.style.lineHeight = lineHeight
    quillInnerEl.style.fontFamily = fontFamily
    quillInnerEl.style.letterSpacing = letterSpacing
    quillInnerEl.style.padding = padding

    quillWrapperEl.style.textAlign = style.textAlign;
    // ---------------------------
    // 4. STABILISATION RENDERING
    // ---------------------------
    quillInnerEl.style.webkitFontSmoothing = 'antialiased'
    quillInnerEl.style.textRendering = 'optimizeLegibility'

    Object.assign(quillInnerEl.style, {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textAlign: style.textAlign,
    })


    // ---------------------------
    // 5. OPTION : ALIGNEMENT GRID (utile si pagination stricte)
    // ---------------------------
    const lineHeightPx = parseFloat(lineHeight)
    if (!Number.isNaN(lineHeightPx)) {
        quillInnerEl.dataset.lineHeightPx = lineHeightPx
    }
}