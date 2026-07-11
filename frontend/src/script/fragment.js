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

            // Stamp avant capture du HTML : l'attribut doit être présent
            // dans la chaîne qui finira sérialisée puis injectée via v-html.
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

        // La frontière entre deux fragments d'un même bloc est une
        // coupure de PAGINATION, pas une coupure de PARAGRAPHE : on
        // recolle donc le dernier morceau accumulé avec le premier
        // morceau du fragment suivant. Seules les coupures introduites
        // par l'édition elle-même (Quill produit plusieurs <p>) créent
        // de nouveaux paragraphes.
        // Paged.js peut couper en plein milieu d'un espace inter-mots sans le
        // reporter d'un côté ni de l'autre du saut de page : recoller tel quel
        // fusionnerait alors les deux mots (cf. bug justification qui saute).
        // On ne réinjecte un espace que si aucun des deux morceaux n'en a déjà
        // un à la jointure, pour ne jamais en doubler.
        const glued = []
        order.forEach((id, i) => {
            const pieces = piecesOf(id)
            if (i === 0) {
                glued.push(...pieces)
                return
            }
            const [first, ...rest] = pieces
            // Les fragments d'un même bloc partagent toujours le même type
            // (Paged.js les a produits en coupant physiquement UN bloc
            // d'origine, jamais en recomposant deux blocs différents) :
            // pas besoin de garde de compatibilité de type ici. Pour une
            // liste, on concatène les items (pas de perte des bords de
            // <li>) ; pour un paragraphe, on recolle le texte comme avant.
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

    // Retrouve, pour un bloc donné, quel fragment de PAGINATION contient
    // l'index de caractère `charIndex` (mesuré depuis le début du paragraphe
    // complet, coupures de page recollées). Nécessaire pour rouvrir l'éditeur
    // au bon endroit après un split/merge : le résultat ne tombe pas toujours
    // dans le premier fragment dès que le paragraphe s'étale sur plusieurs pages.
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

    // Position d'un fragment au sein de son bloc (ordinal + nombre total de
    // fragments de pagination). Sert à distinguer une frontière de PAGE
    // (interne au paragraphe, sans conséquence) d'une véritable frontière de
    // PARAGRAPHE (début/fin réel, seule situation où une fusion doit agir).
    function getFragmentPosition(fragId) {
        const entry = fragmentMap.get(fragId)
        if (!entry) return null

        const order = blockFragments.get(entry.blockId) ?? [fragId]
        return { ordinal: entry.ordinal, total: order.length }
    }

    // Inverse de locateIndex : convertit une position locale à l'intérieur
    // d'un fragment de pagination (fragId + index de caractère local) en
    // position globale dans le paragraphe complet (blockId + index, coupures
    // de page recollées). Nécessaire pour résoudre une sélection dont les
    // deux bords tombent dans des fragments différents (même page-cassure
    // interne à un paragraphe, ou véritable frontière entre deux paragraphes).
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

// Faut-il un espace à la jointure de deux morceaux de pagination ? Seulement
// si aucun des deux ne se termine/commence déjà par un blanc — sinon on
// doublerait un espace que Paged.js a en fait bien conservé d'un côté.
function joinNeedsSpace(prevHtml, nextHtml) {
    const prevText = textOf(prevHtml)
    const nextText = textOf(nextHtml)
    return prevText !== '' && nextText !== '' && !/\s$/.test(prevText) && !/^\s/.test(nextText)
}

// Une entrée de `owner.texte[]` : { type: 'paragraph', text } ou
// { type: 'list', ordered, items: [{ text, depth }] } — cf.
// backend/src/import/odt-parser.ts (TexteEntry) dont ce format est le
// pendant frontend. `depth` suit la convention Quill (classes ql-indent-N
// sur des <li> à plat, pas de <ul>/<ol> imbriqués).

function parseListItems(listEl) {
    return [...listEl.children].map((li) => {
        const match = /ql-indent-(\d+)/.exec(li.className || '')
        return { text: li.innerHTML, depth: match ? parseInt(match[1], 10) : 0 }
    })
}

// Découpe le HTML produit par Quill en entrées `texte[]` : un <ul>/<ol> de
// haut niveau devient UNE entrée liste (tous ses <li>), tout le reste
// (typiquement des <p>) devient une entrée paragraphe par élément —
// symétrique de renderTexteEntry.
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

// Inverse d'extractParagraphs : reconstruit le HTML d'une entrée texte[]
// pour l'affichage/l'édition (buildBlocks, setFragment).
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

// Texte "adressable" par offset de caractère d'une entrée — pour un
// paragraphe, son HTML brut ; pour une liste, la concaténation du HTML de
// ses items (sans séparateur, cf. renderTexteEntry). Même limitation déjà
// documentée pour les paragraphes : une longueur de chaîne HTML brute, pas
// un compte de caractères visibles.
export function entryText(entry) {
    return entry.type === 'list' ? entry.items.map((item) => item.text).join('') : entry.text
}