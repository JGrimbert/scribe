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

// Rects (un par ligne visuelle) pour la portion de texte [startCharIdx,
// endCharIdx) à l'intérieur d'un seul élément. Contrairement à une Range
// native construite sur la sélection du navigateur (qui peut enjamber
// plusieurs éléments de fragments différents et produire un rendu peu
// fiable), cette Range est toujours scopée à UN SEUL élément — à appliquer
// fragment par fragment pour composer l'overlay d'une sélection cross-fragment.
export function getRangeRects(el, startCharIdx, endCharIdx) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let count = 0
    let startNode = null, startOffset = 0
    let endNode = null, endOffset = 0
    let node, lastNode = null

    while ((node = walker.nextNode())) {
        lastNode = node
        const len = node.textContent.length

        if (startNode === null && count + len >= startCharIdx) {
            startNode = node
            startOffset = Math.max(0, startCharIdx - count)
        }
        if (count + len >= endCharIdx) {
            endNode = node
            endOffset = Math.max(0, endCharIdx - count)
            break
        }
        count += len
    }

    if (!startNode) return []
    if (!endNode) {
        // endCharIdx dépasse le texte disponible (ex: Infinity pour "jusqu'à
        // la fin du fragment") : on borne à la fin du dernier nœud texte.
        endNode = lastNode
        endOffset = lastNode ? lastNode.textContent.length : 0
    }

    const range = document.createRange()
    range.setStart(startNode, Math.min(startOffset, startNode.textContent.length))
    range.setEnd(endNode, Math.min(endOffset, endNode.textContent.length))

    return Array.from(range.getClientRects()).map(r => ({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height
    }))
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