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
        // Numéro de chapitre auto (« I. ») préfixé au titre, dans le même style
        // (visuals du styleName). Porté par le nœud, pas un compteur CSS : un
        // article ouvert seul garde son vrai numéro.
        const num = section.outlineNumber ? `${section.outlineNumber} ` : ''

        blocks.push({
            id: `${section.id}__titre`,
            type: 'title',
            path: { kind: 'titre' },
            ownerId: section.id,
            // Style effectif du titre (« Heading 3 ») : stampé en data-style par
            // useFolioFrame → rendu fidèle (centrage, corps) via la feuille visuals.
            styleName: section.styleName,
            html: `<${titleTag}>${num}${section.titre}</${titleTag}>`
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
                // Nom du style effectif : stampé en `data-style` (cf. useFolioFrame),
                // clé de la feuille `visuals` pour un rendu fidèle au .odt.
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

// Blocs d'une PLANCHE d'imposition (aperçu maquette) : une liste ordonnée de pages
// à rendre côte à côte dans UN seul flow Paged.js, à l'échelle du mode `spread`.
// Chaque page est un « slot » : `content` (ses entrées, styleName → visuals, sans
// titre), ou `blank`/`cover`/`empty` (page réelle vide, éventuellement libellée).
// Le premier bloc de chaque slot (sauf le 1er) porte `breakBefore` → useFolioFrame
// force un `break-before:page`, donc N slots = N pages exactement (chaque page de
// contenu tient sur une page physique du .odt, on ne recompose pas).
export function buildImpositionBlocks(pages) {
    const blocks = []

    ;(pages || []).forEach((page, pi) => {
        const first = pi > 0 // marque de saut sur la 1re boîte du slot

        if (page.kind === 'content' && (page.entries?.length)) {
            page.entries.forEach((entry, index) => {
                const e = typeof entry === 'string' ? { type: 'paragraph', text: entry } : entry
                blocks.push({
                    id: `imp_${pi}_${index}`,
                    styleName: e.styleName,
                    // CSS inline libre de l'entrée, au-delà de l'apparence .odt
                    // (`visual`) : ce par quoi un appelant impose une découpe au
                    // bloc — les lambeaux de recherche y passent leur clip-path.
                    style: e.style,
                    // Apparence COMPLÈTE de l'entrée (mise en forme directe .odt
                    // incluse), appliquée en inline par useFolioFrame → fidélité
                    // du liminaire là où le seul styleName perdait les retouches.
                    visual: e.visual,
                    // Data-attributes libres de l'entrée (ex : lambeaux de recherche →
                    // `data-toppath`, variante haut-plat posée après pagination).
                    data: e.data,
                    breakBefore: first && index === 0,
                    html: renderTexteEntry(e),
                })
            })
            return
        }

        // blank | cover | empty (ou content sans entrée) : une page réelle vide.
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