import { Previewer } from 'pagedjs'
import { buildFragmentRegistry, createFragmentApi } from "./fragment.js";
import { createRegistry } from "./registry.js";


/* ------------------ PAGINATION ------------------ */
export async function paginate(data) {

    if (data.sections?.value.length) {

        const article = data.sections.value[2]
        const blocks = buildBlock(article)

        const flow = await measure({
            blocks,
            measureEl: data.measureEl.value,
            config: data.config,
        })

        const blockRegistry = createRegistry(article, blocks, flow)

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

    const flow = previewer.preview(source, ['paged.css'], measureEl).then((flow) => {
        return flow
    })

    flow.idx = idx

    return flow

}

let _uid = 0
const uid = () => `blk_${Date.now()}_${_uid++}`

function buildBlock(section) {
    const blocks = []

    blocks.push({
        id: `${section.id}__titre`,
        type: 'title',
        path: { kind: 'titre' },
        html: `<h3>${section.titre}</h3>`
    })

    ;(section.texte || []).forEach((p, index) => {
        blocks.push({
            id: `${section.id}__texte__${index}`,
            type: 'paragraph',
            path: { kind: 'texte', index },
            html: `<p>${p}</p>`
        })
    })

    if (section.connexe?.pistes?.length) {
        blocks.push({
            id: `${section.id}__pistes`,
            type: 'pistes',
            path: { kind: 'pistes' },
            html: `<div class="pistes">${section.connexe.pistes.map(p => `<p>${p}</p>`).join('')}</div>`
        })
    }

    return blocks
}