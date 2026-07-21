import { Previewer } from 'pagedjs'
import { buildFragmentRegistry, createFragmentApi, renderTexteEntry } from "./fragment.js";
import { createRegistry } from "./registry.js";


/* ------------------ PAGINATION ------------------ */
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

        // Doit s'exécuter AVANT la lecture de page.area.innerHTML ci-dessous :
        // c'est lui qui stamp data-frag-id sur les nœuds réels.
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

let _uid = 0
const uid = () => `blk_${Date.now()}_${_uid++}`

export const TITLE_TAG_BY_DEPTH = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

// Exporté : l'aperçu de config (FolioView) construit le même HTML de blocs que
// l'éditeur pour le donner à paginer à un Previewer tournant DANS son iframe.
export function buildBlocks(sections) {
    const blocks = []

    for (const section of sections) {
        const titleTag = TITLE_TAG_BY_DEPTH[section.depth] ?? 'h6'

        blocks.push({
            id: `${section.id}__titre`,
            type: 'title',
            path: { kind: 'titre' },
            ownerId: section.id,
            html: `<${titleTag}>${section.titre}</${titleTag}>`
        })

        ;(section.texte || []).forEach((entry, index) => {
            // Rétrocompatibilité chemin statique Marvarid/ historique
            // (texte[] en simples strings) — cf. ../../CLAUDE.md.
            const e = typeof entry === 'string' ? { type: 'paragraph', text: entry } : entry
            blocks.push({
                id: `${section.id}__texte__${index}`,
                type: e.type === 'list' ? 'list' : 'paragraph',
                path: { kind: 'texte', index },
                ownerId: section.id,
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