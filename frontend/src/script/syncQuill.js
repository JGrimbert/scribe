export function syncQuillToFragment({
                                        fragmentEl,
                                        quillWrapperEl,
                                        quillInnerEl,
                                        scale,
                                    }) {
    if (!fragmentEl || !quillWrapperEl || !quillInnerEl) return

    // ---------------------------
    // 1. RECT POSITIONNEMENT
    // ---------------------------
    const rect = fragmentEl.getBoundingClientRect()

    quillWrapperEl.style.position = 'fixed'
    quillWrapperEl.style.top = `${rect.top}px`
    quillWrapperEl.style.left = `${rect.left}px`
    quillWrapperEl.style.width = `${rect.width}px`
    quillWrapperEl.style.height = `${rect.height}px`
    quillWrapperEl.style.zIndex = 1000

    // ---------------------------
    // 2. HOMOTHÉTIE INVERSE
    // ---------------------------
    const invScale = 1 / scale

    quillWrapperEl.style.setProperty('--inv-scale', invScale)

    quillInnerEl.style.transformOrigin = 'top left'
    quillInnerEl.style.transform = `scale(${invScale})`

    // IMPORTANT : largeur compensée pour éviter compression horizontale
    quillInnerEl.style.width = `${rect.width * scale}px`

    // ---------------------------
    // 3. TYPOGRAPHIE EXACTE
    // ---------------------------
    const style = window.getComputedStyle(fragmentEl)

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