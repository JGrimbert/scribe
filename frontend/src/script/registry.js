import {extractParagraphs} from "./fragment.js";

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

function mergeNext(owner, block) {

    if (block.path.kind !== 'texte') return null

    const index = block.path.index

    const next = owner.texte[index + 1]

    if (next == null) return null

    const merged = owner.texte[index].trimEnd()

    owner.texte[index] = merged + ' ' + next.trimStart()

    owner.texte.splice(index + 1, 1)

    return { index, cursor: merged.length }
}

function mergePrev(owner, block) {

    if (block.path.kind !== 'texte') return null

    const i = block.path.index
    if (i <= 0) return null

    const merged = owner.texte[i - 1].trimEnd()

    owner.texte[i - 1] = merged + ' ' + owner.texte[i].trimStart()

    owner.texte.splice(i, 1)

    return { index: i - 1, cursor: merged.length }
}

// Supprime une sélection allant du paragraphe `block.path.index` (à partir de
// `startOffset`) jusqu'au paragraphe `endIndex` (jusqu'à `endOffset`) — les
// paragraphes strictement entre les deux disparaissent intégralement.
// `keepSplit: true` (touche Entrée) garde les deux restes comme deux
// paragraphes distincts au lieu de les recoller en un seul ; `insertText`
// (frappe normale) est inséré au point de jonction en même temps que la
// suppression, pour un remplacement atomique de la sélection.
// Même limitation que mergeNext/mergePrev : les offsets sont des longueurs
// de chaîne HTML brute, pas des comptes de caractères visibles.
function deleteRange(owner, block, startOffset, endIndex, endOffset, { keepSplit = false, insertText = '' } = {}) {

    if (block.path.kind !== 'texte') return null

    const startIndex = block.path.index

    const startText = owner.texte[startIndex] ?? ''
    const endText = owner.texte[endIndex] ?? ''

    const before = startText.slice(0, startOffset)
    const after = endText.slice(endOffset)

    if (keepSplit) {
        owner.texte.splice(startIndex, endIndex - startIndex + 1, before, after)
        return { index: startIndex + 1, cursor: 0 }
    }

    const merged = before + insertText + after
    owner.texte.splice(startIndex, endIndex - startIndex + 1, merged)
    return { index: startIndex, cursor: before.length + insertText.length }
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
            owner.connexe.pistes = extractParagraphs(html)
            break
    }
}

function stripTag(html, tag) {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.querySelector(tag)?.innerHTML ?? tmp.innerHTML
}