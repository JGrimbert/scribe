// Navigation clavier verticale (ArrowUp/ArrowDown) entre fragments Quill : un
// seul Quill est monté à la fois (voir CLAUDE.md racine), donc "descendre"
// depuis la dernière ligne visuelle d'un fragment doit être détecté ici puis
// résolu dans le fragment voisin en préservant la position horizontale.
// `quill.getBounds(index)` renvoie un rect en coordonnées LOCALES à l'éditeur
// (indépendant du zoom/scale de la page) : comparable tel quel entre deux
// instances Quill différentes, tant que les deux partagent la même mise en
// page (même largeur de panneau, même police) — ce qui est le cas ici, tous
// les QuillBlock étant rendus dans le même panneau flottant fixe.

const LINE_TOP_EPS = 2 // tolérance (px) pour "même ligne visuelle"

function cleanLength(quill) {
    return quill.getText().replace(/\n$/, '').length
}

// Étend depuis edgeIndex vers l'intérieur du texte tant que les caractères
// restent sur la même ligne visuelle (même bounds.top, à EPS près). Donne la
// plage [lo, hi] de la ligne contenant edgeIndex.
function visualLineRange(quill, edgeIndex, direction) {
    const len = cleanLength(quill)
    const top = quill.getBounds(edgeIndex).top
    let lo = edgeIndex, hi = edgeIndex

    if (direction === 'forward') {
        while (hi + 1 < len && Math.abs(quill.getBounds(hi + 1).top - top) <= LINE_TOP_EPS) hi++
    } else {
        while (lo - 1 >= 0 && Math.abs(quill.getBounds(lo - 1).top - top) <= LINE_TOP_EPS) lo--
    }
    return { lo, hi, top }
}

export function isOnFirstLine(quill, index) {
    if (index <= 0) return true
    const { top } = visualLineRange(quill, 0, 'forward')
    return Math.abs(quill.getBounds(index).top - top) <= LINE_TOP_EPS
}

export function isOnLastLine(quill, index) {
    const len = cleanLength(quill)
    if (len === 0) return true
    const lastIndex = len - 1
    const { top } = visualLineRange(quill, lastIndex, 'backward')
    return Math.abs(quill.getBounds(index).top - top) <= LINE_TOP_EPS
}

// Résout un x horizontal (coordonnées locales à l'éditeur, cf. quill.getBounds)
// en index de caractère sur la première/dernière ligne visuelle du fragment —
// c'est l'inverse de "capturer x avant de sortir du fragment" : à l'arrivée
// dans le fragment voisin, on cherche sur son bord d'entrée (première ligne
// si on vient d'un ArrowDown, dernière si on vient d'un ArrowUp) l'index dont
// le bord horizontal est le plus proche de x.
export function resolveIndexForX(quill, x, edge) {
    const len = cleanLength(quill)
    if (len === 0) return 0

    const edgeIndex = edge === 'first' ? 0 : len - 1
    const { lo, hi } = visualLineRange(quill, edgeIndex, edge === 'first' ? 'forward' : 'backward')

    let best = edgeIndex
    let bestDist = Infinity
    for (let i = lo; i <= hi; i++) {
        const dist = Math.abs(quill.getBounds(i).left - x)
        if (dist < bestDist) { bestDist = dist; best = i }
    }
    return best
}
