// Aligne les MÉTRIQUES de rendu du Quill flottant sur celles du fragment Folio pour que
// le wrapping soit identique (d'où isOnFirstLine/isOnLastLine fiables). Ne repositionne
// PAS Quill : invisible en usage réel (curseur/rects viennent du DOM Folio), sa place à
// l'écran est indifférente.
export function syncQuillToFragment({ fragmentEl, quillWrapperEl, quillInnerEl, scale }) {
    if (!fragmentEl || !quillWrapperEl || !quillInnerEl) return

    // Réalm du fragment (l'iframe) : getComputedStyle/getBoundingClientRect y sont relatifs.
    const win = fragmentEl.ownerDocument.defaultView
    const rect = fragmentEl.getBoundingClientRect()
    const style = win.getComputedStyle(fragmentEl)

    // Homothétie : le fragment vit sous `transform: scale`, son rect est DÉJÀ scalé mais
    // sa font-size non. On met Quill aux métriques réelles (W = rect.width/scale, même
    // police) puis on le réduit du même `scale` → ratio largeur/police (W/F) identique,
    // donc mêmes retours à la ligne.
    quillInnerEl.style.transformOrigin = 'top left'
    quillInnerEl.style.transform = `scale(${scale})`
    quillInnerEl.style.width = `${rect.width / scale}px`

    // Typo recopiée du fragment. Ni text-rendering ni font-smoothing forcés : le Folio les
    // laisse au défaut, les imposer ici changerait le kerning → wrapping divergent.
    Object.assign(quillInnerEl.style, {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        wordSpacing: style.wordSpacing,
        padding: style.padding,
        textAlign: style.textAlign,
    })
}
