export function buildFragmentRegistry(flow) {
    const fragmentMap = new Map()      // fragId -> { blockId, ordinal, html }
    const blockFragments = new Map()   // blockId -> [fragId...] dans l'ordre
    const blockIndex = []

    flow.pages.forEach((page) => {
        const area = page.area
        if (!area) return

        area.querySelectorAll('[data-block-id]').forEach((node) => {
            const blockId = node.dataset.blockId
            if (!blockId) return

            const order = blockFragments.get(blockId) ?? []
            const ordinal = order.length
            const fragId = `${blockId}::${ordinal}`

            // Stamp avant capture du HTML : l'attribut doit être dans la chaîne
            // sérialisée puis injectée via v-html.
            node.setAttribute('data-frag-id', fragId)

            fragmentMap.set(fragId, {
                blockId,
                ordinal,
                html: node.outerHTML,
            })

            order.push(fragId)
            blockFragments.set(blockId, order)
            blockIndex.push(blockId)
        })
    })

    return { fragmentMap, blockFragments, blockIndex }
}

export function createFragmentApi(blockRegistry, fragmentMap, blockFragments) {

    function getFragment(fragId) {
        return fragmentMap.get(fragId)?.html ?? null
    }

    function getBlockId(fragId) {
        return fragmentMap.get(fragId)?.blockId ?? null
    }

    function setFragment(fragId, html) {

        const entry = fragmentMap.get(fragId)
        if (!entry) return

        const { blockId } = entry
        const order = blockFragments.get(blockId) ?? [fragId]

        const piecesOf = (id) => id === fragId
            ? extractParagraphs(html)
            : extractParagraphs(fragmentMap.get(id).html)

        // La frontière entre deux fragments d'un même bloc est une coupure de
        // PAGINATION, pas de paragraphe : on recolle. Paged.js peut couper en plein
        // espace inter-mots sans le reporter (cf. bug justification qui saute) : on
        // ne réinjecte un espace que si aucun des deux morceaux n'en a déjà un.
        const glued = []
        order.forEach((id, i) => {
            const pieces = piecesOf(id)
            if (i === 0) {
                glued.push(...pieces)
                return
            }
            const [first, ...rest] = pieces
            // Fragments d'un même bloc = même type (Paged.js coupe UN bloc, ne
            // recompose pas) : pas de garde de compatibilité.
            const last = glued[glued.length - 1]
            if (last.type === 'list' && first.type === 'list') {
                glued[glued.length - 1] = { type: 'list', ordered: last.ordered, items: [...last.items, ...first.items] }
            } else {
                const sep = joinNeedsSpace(entryText(last), entryText(first)) ? ' ' : ''
                glued[glued.length - 1] = { type: 'paragraph', text: entryText(last) + sep + entryText(first) }
            }
            glued.push(...rest)
        })

        const assembled = glued.map(renderTexteEntry).join('')

        blockRegistry.get(blockId)?.setHtml(assembled)
    }

    // Quel fragment de pagination contient `charIndex` (mesuré dans le paragraphe
    // complet, coupures recollées). Pour rouvrir l'éditeur au bon endroit après un
    // split/merge quand le paragraphe s'étale sur plusieurs pages.
    function locateIndex(blockId, charIndex) {
        const order = blockFragments.get(blockId) ?? []
        if (!order.length) return { fragId: `${blockId}::0`, index: charIndex }

        let offset = 0
        for (let i = 0; i < order.length; i++) {
            const fragId = order[i]
            const isLast = i === order.length - 1
            const len = textLengthOf(fragmentMap.get(fragId)?.html)

            if (isLast || charIndex <= offset + len) {
                return { fragId, index: Math.max(0, charIndex - offset) }
            }
            offset += len
        }
    }

    // Ordinal + total de fragments d'un bloc : distingue une frontière de PAGE
    // (interne, sans conséquence) d'une vraie frontière de PARAGRAPHE (où une fusion
    // doit agir).
    function getFragmentPosition(fragId) {
        const entry = fragmentMap.get(fragId)
        if (!entry) return null

        const order = blockFragments.get(entry.blockId) ?? [fragId]
        return { ordinal: entry.ordinal, total: order.length }
    }

    // Inverse de locateIndex : position locale (fragId + index) → position globale
    // dans le paragraphe complet. Pour une sélection à cheval sur deux fragments.
    function globalIndex(fragId, localIndex) {
        const entry = fragmentMap.get(fragId)
        if (!entry) return null

        const order = blockFragments.get(entry.blockId) ?? [fragId]
        let offset = 0
        for (const id of order) {
            if (id === fragId) return { blockId: entry.blockId, index: offset + localIndex }
            offset += textLengthOf(fragmentMap.get(id)?.html)
        }
        return null
    }

    return { getFragment, getBlockId, setFragment, locateIndex, getFragmentPosition, globalIndex }
}

function textOf(html) {
    if (!html) return ''
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || ''
}

function textLengthOf(html) {
    return textOf(html).length
}

// Espace à la jointure seulement si aucun des deux morceaux n'en a déjà un (sinon on
// doublerait un espace que Paged.js a conservé d'un côté).
function joinNeedsSpace(prevHtml, nextHtml) {
    const prevText = textOf(prevHtml)
    const nextText = textOf(nextHtml)
    return prevText !== '' && nextText !== '' && !/\s$/.test(prevText) && !/^\s/.test(nextText)
}

// Une entrée de `owner.texte[]`, pendant frontend de TexteEntry (odt-parser). `depth`
// suit la convention Quill (classes ql-indent-N sur des <li> à plat).
function parseListItems(listEl) {
    return [...listEl.children].map((li) => {
        const match = /ql-indent-(\d+)/.exec(li.className || '')
        return { text: li.innerHTML, depth: match ? parseInt(match[1], 10) : 0 }
    })
}

// HTML Quill → entrées `texte[]` : un <ul>/<ol> de haut niveau devient UNE entrée
// liste, le reste une entrée paragraphe par élément. Symétrique de renderTexteEntry.
export function extractParagraphs(html) {

    const tmp = document.createElement('div')
    tmp.innerHTML = html

    const children = [...tmp.children]

    if (children.length) {
        return children.map((el) => {
            if (el.tagName === 'UL' || el.tagName === 'OL') {
                return { type: 'list', ordered: el.tagName === 'OL', items: parseListItems(el) }
            }
            return { type: 'paragraph', text: el.innerHTML }
        })
    }

    return [{ type: 'paragraph', text: tmp.innerHTML }]
}

// Inverse d'extractParagraphs (buildBlocks, setFragment).
export function renderTexteEntry(entry) {
    if (entry.type === 'list') {
        const tag = entry.ordered ? 'ol' : 'ul'
        const items = entry.items
            .map((item) => `<li${item.depth > 0 ? ` class="ql-indent-${item.depth}"` : ''}>${item.text}</li>`)
            .join('')
        return `<${tag}>${items}</${tag}>`
    }
    return `<p>${entry.text}</p>`
}

// Texte adressable par offset d'une entrée. Limitation connue : longueur de chaîne
// HTML brute, pas un compte de caractères visibles.
export function entryText(entry) {
    return entry.type === 'list' ? entry.items.map((item) => item.text).join('') : entry.text
}
