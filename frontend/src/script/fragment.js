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
            const sep = joinNeedsSpace(glued[glued.length - 1], first) ? ' ' : ''
            glued[glued.length - 1] += sep + first
            glued.push(...rest)
        })

        const assembled = glued.map(p => `<p>${p}</p>`).join('')

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

export function extractParagraphs(html) {

    const tmp = document.createElement('div')
    tmp.innerHTML = html

    const ps = [...tmp.querySelectorAll('p')]

    if (ps.length) {
        return ps.map(p => p.innerHTML)
    }

    return [tmp.innerHTML]
}