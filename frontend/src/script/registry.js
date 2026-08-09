import {extractParagraphs, entryText} from "./fragment.js";

export function createRegistry(owners, blocks, flow) {
    const map = new Map()
    blocks.forEach(block => {
        const owner = owners.get(block.ownerId)
        map.set(block.id, {

            type: block.type,

            getHtml: (ref) => block.html,

            setHtml: (html) => applyEdit(owner, block, html),

            mergeNext: () => mergeNext(owner, block),

            mergePrev: () => mergePrev(owner, block),

            deleteRange: (startOffset, endIndex, endOffset, opts) =>
                deleteRange(owner, block, startOffset, endIndex, endOffset, opts),
        })
    })
    return map
}

// Deux entrées fusionnent-elles ? p+p : toujours. liste+liste : même `ordered` seulement.
// p+liste : jamais (pas de HTML valide). No-op sûr sinon.
function canMerge(a, b) {
    if (a.type !== b.type) return false
    return a.type !== 'list' || a.ordered === b.ordered
}

function mergeEntries(a, b) {
    if (a.type === 'list') {
        return { entry: { type: 'list', ordered: a.ordered, items: [...a.items, ...b.items] }, cursor: entryText(a).length }
    }
    const left = a.text.trimEnd()
    return { entry: { type: 'paragraph', text: left + ' ' + b.text.trimStart() }, cursor: left.length }
}

function mergeNext(owner, block) {

    if (block.path.kind !== 'texte') return null

    const index = block.path.index

    const cur = owner.texte[index]
    const next = owner.texte[index + 1]

    if (next == null) return null
    if (!canMerge(cur, next)) return null

    const { entry, cursor } = mergeEntries(cur, next)
    owner.texte[index] = entry

    owner.texte.splice(index + 1, 1)

    return { index, cursor }
}

function mergePrev(owner, block) {

    if (block.path.kind !== 'texte') return null

    const i = block.path.index
    if (i <= 0) return null

    const prev = owner.texte[i - 1]
    const cur = owner.texte[i]

    if (!canMerge(prev, cur)) return null

    const { entry, cursor } = mergeEntries(prev, cur)
    owner.texte[i - 1] = entry

    owner.texte.splice(i, 1)

    return { index: i - 1, cursor }
}

// Découpe une entrée avant/après `offset`. Pour une liste, offset s'applique au texte
// concaténé et la coupure se fait à l'item entier (Entrée/Backspace tombent déjà sur
// des bords d'item côté Quill).
function sliceEntryBefore(entry, offset) {
    if (entry.type === 'list') {
        let acc = 0
        const items = []
        for (const item of entry.items) {
            if (acc >= offset) break
            items.push(item)
            acc += item.text.length
        }
        return { type: 'list', ordered: entry.ordered, items }
    }
    return { type: 'paragraph', text: entry.text.slice(0, offset) }
}

function sliceEntryAfter(entry, offset) {
    if (entry.type === 'list') {
        let acc = 0
        const items = []
        for (const item of entry.items) {
            if (acc >= offset) items.push(item)
            acc += item.text.length
        }
        return { type: 'list', ordered: entry.ordered, items }
    }
    return { type: 'paragraph', text: entry.text.slice(offset) }
}

function concatEntries(before, insertText, after) {
    if (before.type === 'list') {
        const inserted = insertText ? [{ text: insertText, depth: 0 }] : []
        return { type: 'list', ordered: before.ordered, items: [...before.items, ...inserted, ...after.items] }
    }
    return { type: 'paragraph', text: before.text + insertText + after.text }
}

// Supprime la sélection de `block.path.index`/`startOffset` à `endIndex`/`endOffset`
// (les paragraphes entre les deux disparaissent). `keepSplit` (Entrée) garde deux restes
// distincts ; `insertText` (frappe) est inséré au point de jonction (remplacement
// atomique). Offsets = longueurs de chaîne HTML brute, pas de caractères visibles.
function deleteRange(owner, block, startOffset, endIndex, endOffset, { keepSplit = false, insertText = '' } = {}) {

    if (block.path.kind !== 'texte') return null

    const startIndex = block.path.index

    const startEntry = owner.texte[startIndex] ?? { type: 'paragraph', text: '' }
    const endEntry = owner.texte[endIndex] ?? { type: 'paragraph', text: '' }

    const before = sliceEntryBefore(startEntry, startOffset)
    const after = sliceEntryAfter(endEntry, endOffset)

    if (keepSplit) {
        owner.texte.splice(startIndex, endIndex - startIndex + 1, before, after)
        return { index: startIndex + 1, cursor: 0 }
    }

    // Sélection à cheval paragraphe/liste : pas de fusion valide, on garde les deux.
    if (!canMerge(before, after)) {
        owner.texte.splice(startIndex, endIndex - startIndex + 1, before, after)
        return { index: startIndex + 1, cursor: 0 }
    }

    const merged = concatEntries(before, insertText, after)
    owner.texte.splice(startIndex, endIndex - startIndex + 1, merged)
    return { index: startIndex, cursor: entryText(before).length + insertText.length }
}

function applyEdit(owner, block, html) {

    switch (block.path.kind) {

        case 'titre':
            owner.titre = stripTag(html, 'h3')
            break

        case 'texte': {

            const paragraphs = extractParagraphs(html)

            owner.texte.splice(
                block.path.index,
                1,
                ...paragraphs
            )

            break
        }

        case 'pistes':
            // Les pistes restent un tableau de strings ; entryText réextrait le brut.
            owner.connexe.pistes = extractParagraphs(html).map(entryText)
            break
    }
}

function stripTag(html, tag) {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.querySelector(tag)?.innerHTML ?? tmp.innerHTML
}
