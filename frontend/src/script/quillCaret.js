// Navigation verticale entre fragments Quill (un seul Quill monté à la fois) : détecter
// qu'on est sur la dernière/première ligne VISUELLE (pas juste le dernier caractère)
// avant de laisser la flèche sortir. La position d'arrivée est résolue ensuite côté
// useFragmentEditor sur le DOM Folio rendu.

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
