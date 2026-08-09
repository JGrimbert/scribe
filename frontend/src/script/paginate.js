import { Previewer } from 'pagedjs'
import { buildFragmentRegistry, createFragmentApi, renderTexteEntry } from "./fragment.js";
import { createRegistry } from "./registry.js";


export async function paginate(data) {

    if (data.sections?.value.length) {

        const sections = data.sections.value
        const blocks = buildBlocks(sections)

        const flow = await measure({
            blocks,
            measureEl: data.measureEl.value,
            config: data.config,
        })

        const owners = new Map(sections.map((section) => [section.id, section]))
        const blockRegistry = createRegistry(owners, blocks, flow)

        // AVANT la lecture de page.area.innerHTML : c'est lui qui stamp data-frag-id.
        const { fragmentMap, blockFragments, blockIndex } = buildFragmentRegistry(flow)
        const fragments = createFragmentApi(blockRegistry, fragmentMap, blockFragments)

        const pages = flow.pages.map((page) => page.area.innerHTML)

        return { pages, registry: blockRegistry, fragments, blockIndex }
    }

    return { pages: [], registry: new Map(), fragments: null }
}

function measure({ measureEl, blocks }) {

    const doc = document.implementation.createHTMLDocument();
    const sourceContent = document.getElementById("source-content").content.cloneNode(true);

    doc.body.appendChild(sourceContent);

    const colTarget = doc.getElementById("target");

    blocks.forEach((obj) => {
        const tmp = document.createElement('div')
        tmp.innerHTML = obj.html
        const root = tmp.firstElementChild
        root.setAttribute('data-block-id', obj.id)
        colTarget.appendChild(root)
    })

    const previewer = new Previewer();
    const idx = new Map()

    const source = document.createElement("div");
    source.innerHTML = doc.body.innerHTML;

    const flow = previewer.preview(source, ['/paged.css'], measureEl).then((flow) => {
        return flow
    })

    flow.idx = idx

    return flow

}

export const TITLE_TAG_BY_DEPTH = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

// Exporté : FolioView construit le même HTML de blocs pour le paginer dans son iframe.
export function buildBlocks(sections) {
    const blocks = []

    for (const section of sections) {
        const titleTag = TITLE_TAG_BY_DEPTH[section.depth] ?? 'h6'
        // Numéro auto préfixé au titre (porté par le nœud, pas un compteur CSS : un
        // article ouvert seul garde son vrai numéro).
        const num = section.outlineNumber ? `${section.outlineNumber} ` : ''

        blocks.push({
            id: `${section.id}__titre`,
            type: 'title',
            path: { kind: 'titre' },
            ownerId: section.id,
            // styleName stampé en data-style par useFolioFrame → rendu fidèle via visuals.
            styleName: section.styleName,
            html: `<${titleTag}>${num}${section.titre}</${titleTag}>`
        })

        ;(section.texte || []).forEach((entry, index) => {
            // Rétrocompat chemin statique Marvarid/ (texte[] en strings).
            const e = typeof entry === 'string' ? { type: 'paragraph', text: entry } : entry
            blocks.push({
                id: `${section.id}__texte__${index}`,
                type: e.type === 'list' ? 'list' : 'paragraph',
                path: { kind: 'texte', index },
                ownerId: section.id,
                styleName: e.styleName,
                html: renderTexteEntry(e)
            })
        })

        if (section.connexe?.pistes?.length) {
            blocks.push({
                id: `${section.id}__pistes`,
                type: 'pistes',
                path: { kind: 'pistes' },
                ownerId: section.id,
                html: `<div class="pistes">${section.connexe.pistes.map(p => `<p>${p}</p>`).join('')}</div>`
            })
        }

        if (section.connexe?.tableau?.length) {
            const rows = section.connexe.tableau
                .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
                .join('')
            blocks.push({
                id: `${section.id}__tableau`,
                type: 'tableau',
                path: { kind: 'tableau' },
                ownerId: section.id,
                html: `<table class="tableau-connexe">${rows}</table>`
            })
        }
    }

    return blocks
}

// Blocs d'une PLANCHE d'imposition (aperçu maquette), rendus côte à côte dans un seul
// flow. Le 1er bloc de chaque slot (sauf le 1er) porte `breakBefore` → N slots = N pages
// exactement (on ne recompose pas). Un slot est `content` (ses entrées, sans titre) ou
// `blank`/`cover`/`empty`.
export function buildImpositionBlocks(pages) {
    const blocks = []

    ;(pages || []).forEach((page, pi) => {
        const first = pi > 0

        if (page.kind === 'content' && (page.entries?.length)) {
            page.entries.forEach((entry, index) => {
                const e = typeof entry === 'string' ? { type: 'paragraph', text: entry } : entry
                blocks.push({
                    id: `imp_${pi}_${index}`,
                    styleName: e.styleName,
                    // CSS inline libre : ce par quoi un appelant impose une découpe (les
                    // lambeaux de recherche y passent leur clip-path).
                    style: e.style,
                    // Apparence complète .odt (mise en forme directe incluse) → fidélité
                    // du liminaire là où le seul styleName perdait les retouches.
                    visual: e.visual,
                    // Data-attributes libres ; la clé de l'entrée en `data-entry-key`
                    // (l'overlay liminaire y ancre ses contrôles de découpage).
                    data: e.key ? { ...(e.data ?? {}), 'entry-key': e.key } : e.data,
                    breakBefore: first && index === 0,
                    html: renderTexteEntry(e),
                })
            })
            return
        }

        // blank | cover | empty : une page réelle vide.
        const kind = page.kind === 'content' ? 'empty' : page.kind
        const label = page.label ? `<span class="imp-slot-label">${page.label}</span>` : ''
        blocks.push({
            id: `imp_${pi}_slot`,
            breakBefore: first,
            html: `<div class="imp-slot imp-slot--${kind}">${label}</div>`,
        })
    })

    return blocks
}
