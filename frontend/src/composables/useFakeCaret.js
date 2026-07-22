import { ref } from 'vue'
import { getCaretRect } from '../script/liveEdit.js'

// Le DOM affiché (v-html) n'est pas éditable : ce composable pilote le faux
// curseur clignotant / les rectangles de sélection qui se superposent à ce DOM.
//
// `offset()` rend { x, y } à AJOUTER aux rects : nul par défaut (l'éditeur
// historique, dont le DOM Folio est dans le document principal), il vaut la
// position écran de l'iframe quand le DOM Folio y vit (mode édition unifié). Les
// rects issus de getBoundingClientRect/getClientRects sont relatifs au viewport
// de LEUR document ; l'overlay, lui, est téléporté en `fixed` dans le body
// principal — d'où le recalage.
export function useFakeCaret(findFragEl, offset = () => ({ x: 0, y: 0 })) {
    const cursorRect = ref(null)
    const selectionRects = ref([])

    function setCaretRect(el, index) {
        const rect = el && index != null ? getCaretRect(el, index) : null
        if (!rect) { cursorRect.value = null; return }
        const { x, y } = offset()
        cursorRect.value = { top: rect.top + y, left: rect.left + x, height: rect.height || 18 }
    }

    function setSelectionRects(rects) {
        const { x, y } = offset()
        selectionRects.value = (x || y)
            ? rects.map((r) => ({ ...r, top: r.top + y, left: r.left + x }))
            : rects
    }

    function clear() {
        cursorRect.value = null
        selectionRects.value = []
    }

    // Curseur ponctuel (length === 0) ou sélection déjà calculée en amont
    // (cf. onColumnMouseUp) et passée via setSelectionRects.
    function updateCaretOrSelection(fragId, index, length = 0) {
        const el = findFragEl(fragId)

        if (!el || index == null) {
            clear()
            return
        }

        if (length > 0) {
            cursorRect.value = null
            return
        }

        selectionRects.value = []
        setCaretRect(el, index)
    }

    return { cursorRect, selectionRects, updateCaretOrSelection, setCaretRect, setSelectionRects, clear }
}
