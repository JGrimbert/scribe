// Pages d'imposition de l'« aperçu déchiré » : coulées dans le MÊME FolioView que la
// recherche/annotations (feuilles déchirées, clip-path, molette — cf. searchFragment), MAIS
// à contenu FIDÈLE. On injecte le vrai HTML des blocs avec leur `data-style` : le stylesheet
// visuals de l'iframe (`.pagedjs_page_content [data-style="X"]`, cf. folioStyles) applique
// alors police/corps/alignement/couleur d'origine — pas de rendu générique.
//
// Deux registres de lambeaux :
//  · TÊTE (page 1) : du titre jusqu'au 1er paragraphe (inclus) du 1er chapitre du niveau,
//    rendu normal, clos par un SEUL […] (l'interruption marque la coupure du bas) ;
//  · lambeaux SUPPLÉMENTAIRES (page 2, empilés) : un par style/genre non montré dans la
//    tête, collecté sur TOUT le niveau (chapitres suivants inclus) → les styles « hors
//    modèle » présents ailleurs dans le chapitrage apparaissent aussi. Extrait → encadré de […].
//
// Les feuilles portent les MARGES du livre en padding (le FolioView reçoit des marges @page
// à 0 en torn) : chaque lambeau est un vrai morceau de PAGE, texte encné comme dans le livre.
import { buildBlocks } from './paginate.js'
import { nodesAtDepthKey } from './chapitrageNodes.js'
import { tornPolygon } from './searchFragment.js'

// drop-shadow (pas box-shadow) : elle doit épouser la découpe (le clip-path rognerait un
// box-shadow). Le morceau est posé sur la TRAME (pages transparentes) : blanc, il s'y détache.
const SHEET_SHADOW = 'filter:drop-shadow(0 1px 6px rgba(0,0,0,.15));'
const SHEET_BG = '#fff'
const ELL = '<span class="frag-ell">[…]</span>'

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const cm = (v) => `${Number(v ?? 0)}cm`

// Padding = marges du livre. Tête : marges pleines (vrai haut de page). Lambeau isolé :
// mêmes marges latérales (colonne de texte à la largeur du livre), verticales resserrées
// (c'est un extrait d'une ligne, pas un haut de page).
// Bas resserré : la déchirure suit le […] (un vrai morceau arraché), pas la marge de pied.
function headPad(m) {
  return `${cm(m?.topCm ?? 2)} ${cm(m?.outerCm ?? 2)} 0.4cm ${cm(m?.innerCm ?? 2)}`
}
function extraPad(m) {
  return `0.55cm ${cm(m?.outerCm ?? 2)} 0.55cm ${cm(m?.innerCm ?? 2)}`
}

// Stampe data-style sur l'élément racine du HTML d'un bloc (comme useFolioFrame sur les
// blocs réels) → la feuille visuals de l'iframe le rend fidèlement. Bloc sans style
// (tableau, pistes) : laissé nu (rendu par défaut).
function withDataStyle(block) {
  if (!block.styleName) return block.html
  return String(block.html).replace(/^<([a-zA-Z][\w-]*)/, `<$1 data-style="${escAttr(block.styleName)}"`)
}

// Une feuille déchirée = deux boîtes : l'extérieure porte l'ombre, l'intérieure
// (`.frag-sheet`) le papier + la découpe + les marges (padding). `data-toppath` (haut plat)
// est réappliqué par useFolioFrame à la feuille qui coiffe une page.
function tornEntry(innerHtml, seed, pad) {
  return {
    type: 'html',
    text:
      '<div><div class="frag-sheet" style="'
      + `clip-path:${tornPolygon(seed)};background:${SHEET_BG};padding:${pad};">`
      + innerHtml
      + '</div></div>',
    style: `${SHEET_SHADOW}margin:0 0 14px;break-inside:avoid;`,
    data: { toppath: tornPolygon(seed, { flatTop: true }) },
  }
}

// Fin de la TÊTE : indice du 1er bloc dont le style se RÉPÈTE plus loin (le « corps » qui
// revient). La tête va du titre jusqu'à ce 1er paragraphe inclus. Sans répétition, tout.
function headEndIndex(blocks) {
  const counts = {}
  for (const b of blocks) if (b.styleName) counts[b.styleName] = (counts[b.styleName] ?? 0) + 1
  for (let i = 0; i < blocks.length; i++) {
    const s = blocks[i].styleName
    if (s && counts[s] > 1) return i
  }
  return blocks.length - 1
}

// Tête + lambeaux supplémentaires → pages d'imposition (page 1 = tête, page 2 = extras
// empilés — la « deuxième colonne », pour que leurs rows/fuyantes visent la page de droite).
function buildTornPages(head, extras, margins) {
  if (!head.length && !extras.length) return []
  const pages = []
  if (head.length) {
    pages.push({ kind: 'content', entries: [tornEntry(head.map(withDataStyle).join('') + ELL, 1, headPad(margins))] })
  }
  if (extras.length) {
    pages.push({
      kind: 'content',
      entries: extras.map((b, i) => tornEntry(ELL + withDataStyle(b) + ELL, 100 + i, extraPad(margins))),
    })
  }
  return pages
}

// Chapitrage : tête = 1er chapitre du niveau ; extras = styles/genres distincts non montrés
// dans la tête, collectés sur TOUS les chapitres du niveau (styles hors modèle inclus).
export function chapitrageTornPages(axes, data, depthKey, margins) {
  if (depthKey == null) return []
  const nodes = nodesAtDepthKey(axes, data, depthKey)
  if (!nodes.length) return []

  const firstNode = data?.[nodes[0].nodeId]
  const headBlocks = firstNode
    ? buildBlocks([{ ...firstNode, id: nodes[0].nodeId, depth: depthKey }])
    : []
  const k = headEndIndex(headBlocks)
  const head = headBlocks.slice(0, k + 1)

  const seen = new Set(head.map((b) => b.styleName || b.type))
  const extras = []
  for (const n of nodes) {
    const node = data?.[n.nodeId]
    if (!node) continue
    for (const b of buildBlocks([{ ...node, id: n.nodeId, depth: depthKey }])) {
      const kind = b.styleName || b.type
      if (!kind || seen.has(kind)) continue
      seen.add(kind)
      extras.push(b)
    }
  }
  return buildTornPages(head, extras, margins)
}

// Liminaire : toutes les entrées non blanches des planches, aplaties (titre synthétique
// écarté). Tête = début du liminaire, extras = styles non montrés dans la tête.
export function liminaireTornPages(spreads, margins) {
  const texte = []
  for (const spread of spreads ?? []) {
    for (const cell of [spread?.left, spread?.right]) {
      if (!cell || cell.blank || cell.cover) continue
      for (const e of cell.page?.entries ?? []) {
        if (!e || e.isBlank) continue
        texte.push(e)
      }
    }
  }
  const blocks = buildBlocks([{ id: 'liminaire', depth: 0, titre: '', texte }]).filter((b) => b.type !== 'title')
  if (!blocks.length) return []
  const k = headEndIndex(blocks)
  const head = blocks.slice(0, k + 1)
  const seen = new Set(head.map((b) => b.styleName || b.type))
  const extras = []
  for (let i = k + 1; i < blocks.length; i++) {
    const kind = blocks[i].styleName || blocks[i].type
    if (!kind || seen.has(kind)) continue
    seen.add(kind)
    extras.push(blocks[i])
  }
  return buildTornPages(head, extras, margins)
}
