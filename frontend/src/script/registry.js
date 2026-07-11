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

// Deux entrées peuvent-elles fusionner ? Paragraphe+paragraphe : toujours.
// Liste+liste : seulement si même ordered (numéroté/à puces) — sinon
// concaténer produirait un <ul>/<ol> incohérent avec ses propres items.
// Paragraphe+liste : jamais — pas de représentation HTML valide pour un
// mélange des deux dans une seule entrée. No-op sûr dans tous les cas
// incompatibles (même famille que le no-op déjà existant sur une coupure
// de page interne, cf. frontend/CLAUDE.md "Pièges connus").
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

// Découpe une entrée en son début (avant `offset`) — pour une liste, offset
// s'applique au texte concaténé de ses items (cf. fragment.js:entryText) ;
// la coupure se fait à la granularité d'un item entier (pas de découpe en
// plein milieu d'un <li>), suffisant pour les cas réels (Entrée/Backspace
// tombent déjà sur des bords d'item côté Quill).
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

    const startEntry = owner.texte[startIndex] ?? { type: 'paragraph', text: '' }
    const endEntry = owner.texte[endIndex] ?? { type: 'paragraph', text: '' }

    const before = sliceEntryBefore(startEntry, startOffset)
    const after = sliceEntryAfter(endEntry, endOffset)

    if (keepSplit) {
        owner.texte.splice(startIndex, endIndex - startIndex + 1, before, after)
        return { index: startIndex + 1, cursor: 0 }
    }

    if (!canMerge(before, after)) {
        // Sélection à cheval entre un paragraphe et une liste : pas de HTML
        // valide pour une entrée fusionnée, on garde les deux morceaux
        // distincts plutôt que de corrompre le contenu (limite assumée).
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
            // Les pistes restent un tableau de strings (pas de support liste
            // ici) — extractParagraphs renvoie désormais des entrées
            // typées, entryText en réextrait le texte brut.
            owner.connexe.pistes = extractParagraphs(html).map(entryText)
            break
    }
}

function stripTag(html, tag) {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.querySelector(tag)?.innerHTML ?? tmp.innerHTML
}