// Aligne les MÉTRIQUES de rendu du Quill flottant sur celles du fragment Folio,
// pour que le texte y retourne à la ligne EXACTEMENT comme dans le rendu paginé.
// C'est ce qui fait coïncider le wrapping et donc isOnFirstLine/isOnLastLine
// (navigation ↑/↓) avec ce que voit l'utilisateur.
//
// Volontairement PAS de repositionnement : Quill est invisible en usage réel (le
// faux curseur et les rects de sélection sont calculés depuis le DOM Folio, pas
// depuis la position écran de Quill), sa position à l'écran est donc indifférente.
// La boîte reste là où le CSS la met.
export function syncQuillToFragment({ fragmentEl, quillWrapperEl, quillInnerEl, scale }) {
    if (!fragmentEl || !quillWrapperEl || !quillInnerEl) return

    // Réalm du fragment (l'iframe du rendu unifié) : getComputedStyle doit lire
    // dans CE réalm, et getBoundingClientRect y est relatif.
    const win = fragmentEl.ownerDocument.defaultView
    const rect = fragmentEl.getBoundingClientRect()
    const style = win.getComputedStyle(fragmentEl)

    // Homothétie : le fragment vit dans un conteneur `transform: scale(scale)`,
    // donc son getBoundingClientRect est DÉJÀ scalé (= W·scale) alors que sa
    // font-size calculée ne l'est pas (les transforms n'affectent pas le layout).
    // On met Quill en page aux métriques réelles du livre — largeur non scalée
    // W = rect.width/scale, à la même police — puis on le réduit du MÊME `scale`
    // que le Folio : le ratio largeur/police qui gouverne le wrapping devient
    // identique (W/F), donc les retours à la ligne aussi.
    quillInnerEl.style.transformOrigin = 'top left'
    quillInnerEl.style.transform = `scale(${scale})`
    quillInnerEl.style.width = `${rect.width / scale}px`

    // Typo exacte, recopiée du fragment. On ne force NI text-rendering NI
    // font-smoothing : le Folio les laisse au défaut (auto), les imposer ici
    // (optimizeLegibility) introduirait un kerning différent → wrapping divergent.
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
