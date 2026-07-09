// Navigation clavier verticale (ArrowUp/ArrowDown) entre fragments Quill : un
// seul Quill est monté à la fois (voir CLAUDE.md racine), donc QuillBlock doit
// détecter ici qu'on est sur la dernière/première ligne VISUELLE du fragment
// (pas juste le dernier/premier caractère) avant de laisser la flèche sortir
// vers le voisin — la résolution de la position d'arrivée se fait ensuite
// côté useFragmentEditor, sur le DOM Folio déjà rendu (cf. navigateFragment).

const LINE_TOP_EPS = 2 // tolérance (px) pour "même ligne visuelle"

function cleanLength(quill) {
    return quill.getText().replace(/\n$/, '').length
}

export function isOnFirstLine(quill, index) {
    if (index <= 0) return true
    const top = quill.getBounds(0).top
    return Math.abs(quill.getBounds(index).top - top) <= LINE_TOP_EPS
}

export function isOnLastLine(quill, index) {
    const len = cleanLength(quill)
    if (len === 0) return true
    const top = quill.getBounds(len - 1).top
    return Math.abs(quill.getBounds(index).top - top) <= LINE_TOP_EPS
}
