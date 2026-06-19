import { ref } from 'vue'
import { getCaretRect } from '../script/liveEdit.js'

// Le DOM affiché (v-html) n'est pas éditable : ce composable pilote le faux
// curseur clignotant / les rectangles de sélection qui se superposent à ce DOM.
export function useFakeCaret(findFragEl) {
    const cursorRect = ref(null)
    const selectionRects = ref([])

    function setCaretRect(el, index) {
        const rect = el && index != null ? getCaretRect(el, index) : null
        cursorRect.value = rect
            ? { top: rect.top, left: rect.left, height: rect.height || 18 }
            : null
    }

    function setSelectionRects(rects) {
        selectionRects.value = rects
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
