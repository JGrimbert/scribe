/* ------------------ MIRROIR + FAUX CURSEUR ------------------ */

export function applyMirrorHtml(el, quillHtml) {
    const tmp = document.createElement('div')
    tmp.innerHTML = quillHtml
    const tagName = el.tagName.toLowerCase()
    const matching = tmp.querySelector(tagName)
    el.innerHTML = matching ? matching.innerHTML : tmp.innerHTML
}

export function charIndexFromNodeOffset(rootEl, node, offset) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT)
    let count = 0
    let current = walker.nextNode()
    while (current) {
        if (current === node) return count + offset
        count += current.textContent.length
        current = walker.nextNode()
    }
    return count // fallback : fin du contenu
}

export function getCaretRect(root, charIndex) {
    const isContainerOfLines =
        root.tagName === 'DIV' &&
        root.children.length > 0 &&
        Array.from(root.children).every(c => /^(P|H1|H2|H3|H4|H5|H6|LI)$/.test(c.tagName))

    const blocks = isContainerOfLines ? Array.from(root.children) : [root]
    let remaining = charIndex

    for (const block of blocks) {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
        let node, lastNode = null

        while ((node = walker.nextNode())) {
            lastNode = node
            const len = node.textContent.length
            if (remaining <= len) return rectAtOffset(node, remaining)
            remaining -= len
        }

        if (remaining <= 0) {
            return lastNode ? rectAtOffset(lastNode, lastNode.textContent.length) : null
        }
        remaining -= 1 // newline implicite que Quill insère entre deux lignes/blocs
    }

    return null
}

function rectAtOffset(node, offset) {
    const range = document.createRange()
    const safeOffset = Math.min(offset, node.textContent.length)
    range.setStart(node, safeOffset)
    range.collapse(true)
    const rects = range.getClientRects()
    return rects[0] || range.getBoundingClientRect()
}

export function getCharIndexAtPoint(root, x, y) {
    const range = caretRangeFromPoint(x, y)
    if (!range || !root.contains(range.startContainer)) return null

    const isContainerOfLines =
        root.tagName === 'DIV' &&
        root.children.length > 0 &&
        Array.from(root.children).every(c => /^(P|H1|H2|H3|H4|H5|H6|LI)$/.test(c.tagName))

    const blocks = isContainerOfLines ? Array.from(root.children) : [root]
    let total = 0

    for (const block of blocks) {
        if (block.contains(range.startContainer)) {
            return total + offsetWithinBlock(block, range)
        }
        total += textLength(block) + 1 // newline implicite entre blocs
    }

    return Math.max(0, total - 1) // clic après le dernier bloc
}

function caretRangeFromPoint(x, y) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y)
    if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y)
        if (!pos) return null
        const range = document.createRange()
        range.setStart(pos.offsetNode, pos.offset)
        return range
    }
    return null
}

function textLength(block) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    let len = 0, node
    while ((node = walker.nextNode())) len += node.textContent.length
    return len
}

function offsetWithinBlock(block, range) {
    const { startContainer, startOffset } = range

    if (startContainer.nodeType === Node.TEXT_NODE) {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
        let node, total = 0
        while ((node = walker.nextNode())) {
            if (node === startContainer) return total + startOffset
            total += node.textContent.length
        }
        return total
    }

    // clic sur un nœud élément (ex: paragraphe vide)
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    let node, total = 0
    const before = startContainer.childNodes[startOffset - 1] || null

    while ((node = walker.nextNode())) {
        total += node.textContent.length
        if (before && (node === before || before.contains?.(node))) break
    }
    return total
}