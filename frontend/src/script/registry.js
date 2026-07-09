import {extractParagraphs} from "./fragment.js";

export function createRegistry(article, blocks, flow) {
    const map = new Map()
    blocks.forEach(block => {
        map.set(block.id, {

            type: block.type,

            getHtml: (ref) => block.html,

            setHtml: (html) => applyEdit(article, block, html),

            mergeNext: () => mergeNext(article, block),

            mergePrev: () => mergePrev(article, block),

            deleteRange: (startOffset, endIndex, endOffset, opts) =>
                deleteRange(article, block, startOffset, endIndex, endOffset, opts),
        })
    })
    return map
}

function mergeNext(article, block) {

    if (block.path.kind !== 'texte') return null

    const index = block.path.index

    const next = article.texte[index + 1]

    if (next == null) return null

    const merged = article.texte[index].trimEnd()

    article.texte[index] = merged + ' ' + next.trimStart()

    article.texte.splice(index + 1, 1)

    return { index, cursor: merged.length }
}

function mergePrev(article, block) {

    if (block.path.kind !== 'texte') return null

    const i = block.path.index
    if (i <= 0) return null

    const merged = article.texte[i - 1].trimEnd()

    article.texte[i - 1] = merged + ' ' + article.texte[i].trimStart()

    article.texte.splice(i, 1)

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
function deleteRange(article, block, startOffset, endIndex, endOffset, { keepSplit = false, insertText = '' } = {}) {

    if (block.path.kind !== 'texte') return null

    const startIndex = block.path.index

    const startText = article.texte[startIndex] ?? ''
    const endText = article.texte[endIndex] ?? ''

    const before = startText.slice(0, startOffset)
    const after = endText.slice(endOffset)

    if (keepSplit) {
        article.texte.splice(startIndex, endIndex - startIndex + 1, before, after)
        return { index: startIndex + 1, cursor: 0 }
    }

    const merged = before + insertText + after
    article.texte.splice(startIndex, endIndex - startIndex + 1, merged)
    return { index: startIndex, cursor: before.length + insertText.length }
}

function applyEdit(article, block, html) {

    switch (block.path.kind) {

        case 'titre':
            article.titre = stripTag(html, 'h3')
            break

        case 'texte': {

            const paragraphs = extractParagraphs(html)

            article.texte.splice(
                block.path.index,
                1,
                ...paragraphs
            )

            break
        }

        case 'pistes':
            article.connexe.pistes = extractParagraphs(html)
            break
    }
}

function stripTag(html, tag) {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.querySelector(tag)?.innerHTML ?? tmp.innerHTML
}