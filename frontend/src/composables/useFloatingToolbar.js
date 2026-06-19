import { ref } from 'vue'

// Positionne la toolbar Quill (Teleportée dans <body> par QuillBlock) au-dessus
// de la sélection courante.
export function useFloatingToolbar() {
    const toolbarEl = ref(null)

    function registerToolbar(el) {
        if (toolbarEl.value && toolbarEl.value !== el) {
            toolbarEl.value.remove()
        }

        toolbarEl.value = el

        document.body.appendChild(el)

        Object.assign(el.style, {
            position: 'fixed',
            zIndex: 2000,
            display: 'none',
        })
    }

    function updateVisibility(selectionRects) {
        if (!toolbarEl.value) return

        if (!selectionRects.length) {
            toolbarEl.value.style.display = 'none'
            return
        }

        const first = selectionRects[0]
        if (!first) return

        toolbarEl.value.style.display = 'flex'
        toolbarEl.value.style.left = `${first.left + first.width / 2}px`
        toolbarEl.value.style.top = `${first.top - 40}px`
        toolbarEl.value.style.transform = 'translateX(-50%)'
    }

    function hide() {
        if (toolbarEl.value) toolbarEl.value.style.display = 'none'
    }

    return { toolbarEl, registerToolbar, updateVisibility, hide }
}
