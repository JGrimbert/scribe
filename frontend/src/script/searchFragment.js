// Lambeaux de recherche : un passage trouvé rendu en entrées d'imposition, coulées dans
// le MÊME FolioView que les autres vues (fond blanc + bord déchiré posés en style inline
// sur le bloc, la page restant transparente).

// Dents du déchirement : X en %, Y en px (hauteur constante quelle que soit la longueur).
const TEETH = 11
const TOOTH = 7

// Déterministe (mulberry32) : sans graine fixe, le papier se redécouperait à chaque frappe.
function rng(seed) {
  let a = seed * 0x6d2b79f5 + 0x9e3779b9
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// `flatTop` : haut plat (lambeau en tête de page, bord franc). On tire quand même les
// rand() des indices pairs en aplatissant, sinon les dents du BAS se décaleraient.
export function tornPolygon(seed, { flatTop = false } = {}) {
  const rand = rng(seed + 1)
  const top = []
  const bottom = []
  for (let i = 0; i <= TEETH; i++) {
    const x = ((i / TEETH) * 100).toFixed(2)
    const y = i % 2 ? 0 : 1 + rand() * TOOTH
    top.push(`${x}% ${flatTop ? '0px' : `${y.toFixed(1)}px`}`)
  }
  for (let i = TEETH; i >= 0; i--) {
    const x = ((i / TEETH) * 100).toFixed(2)
    const y = i % 2 ? 0 : (1 + rand() * TOOTH).toFixed(1)
    bottom.push(`${x}% calc(100% - ${y}px)`)
  }
  return `polygon(${[...top, ...bottom].join(', ')})`
}

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

// Repli des accents comme la recherche : on compare sur la forme repliée, on restitue
// le texte d'origine.
const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Passage borné de […] avec la saisie en gras, en HTML (il part dans le flow Paged.js).
export function fragmentHtml(phrase, needle) {
  const n = (needle ?? '').trim()
  const ell = '<span class="frag-ell">[…]</span>'
  if (!n) return `${ell}${escapeHtml(phrase)}${ell}`
  const hay = fold(phrase)
  const key = fold(n)
  let out = ''
  let i = 0
  for (;;) {
    const at = hay.indexOf(key, i)
    if (at === -1) break
    out += escapeHtml(phrase.slice(i, at))
    out += `<strong>${escapeHtml(phrase.slice(at, at + key.length))}</strong>`
    i = at + key.length
  }
  out += escapeHtml(phrase.slice(i))
  return `${ell}${out}${ell}`
}

// drop-shadow et non box-shadow : elle doit épouser la découpe (le clip-path rognerait
// un box-shadow — ordre de rendu filter → clip-path).
const SHEET_SHADOW = 'filter:drop-shadow(0 1px 6px rgba(0,0,0,.15));'
// Décalée vers le bas : la source chevauche le bas du lambeau (margin négative).
const SOURCE_SHADOW = 'filter:drop-shadow(0 4px 5px rgba(0,0,0,.15));'

// Une entrée d'imposition par lambeau. DEUX boîtes : le bloc porte l'ombre, la feuille
// interne (.frag-sheet) le papier et sa découpe (un seul élément ferait tailler l'ombre
// par le clip-path). Le `style` inline est la voie par laquelle le clip-path arrive
// dans la page sans que FolioView connaisse la recherche.
export function fragmentEntries(fragments, needle, offset = 0) {
  return fragments.flatMap((f, i) => [
    {
      type: 'paragraph',
      styleName: 'frag',
      text: sheetHtml(tornPolygon(offset + i), fragmentHtml(f.phrase, needle)),
      // break-inside: avoid : un lambeau coupé entre deux pages verrait sa découpe
      // tranchée net.
      style: `${SHEET_SHADOW}margin:0 0 10px;text-align:justify;break-inside:avoid;`,
      // Variante haut-plat, appliquée par useFolioFrame à la feuille qui, après
      // pagination, se retrouve en tête de page.
      data: { toppath: tornPolygon(offset + i, { flatTop: true }) },
    },
    {
      type: 'paragraph',
      styleName: 'frag-source',
      text: escapeHtml(f.path ? `${f.path} › ${f.titre}` : f.titre),
      style: `${SOURCE_SHADOW}background:#fff;padding:0 12px 8px;margin:-10px 0 14px;font-size:.8em;color:#8a7f72;text-align:left;break-before:avoid;break-inside:avoid;`,
    },
  ])
}

function sheetHtml(clip, inner) {
  return `<span class="frag-sheet" style="display:block;background:#fff;clip-path:${clip};padding:10px 12px 8px;">${inner}</span>`
}

// Hors de la plage des résultats (0..n-1) pour que la déchirure du statut ne recopie
// pas celle du premier passage.
const STATUS_SEED = 9973

// Rangée des chiffres du document (cf. useDocStats), dans le lambeau de statut.
function statsRow(stats) {
  if (!stats?.length) return ''
  const cells = stats.map((s) => (
    `<span style="white-space:nowrap;"><b style="font-weight:600;color:#5b6572;">`
    + `${escapeHtml(s.empty || s.value == null ? '—' : String(s.value))}</b> `
    + `<span style="opacity:.7;">${escapeHtml(s.label)}</span></span>`
  )).join('')
  return `<span style="display:flex;flex-wrap:wrap;justify-content:center;gap:.2em 1.1em;`
    + `font-size:.72em;font-weight:400;color:#8a7f72;">${cells}</span>`
}

// Lambeau de statut : toujours en tête (chiffres du document puis compte de résultats).
export function statusEntry(status, stats) {
  const rows = statsRow(stats)
    + `<span style="display:block;margin-top:.7em;">${escapeHtml(status)}</span>`
  return {
    type: 'paragraph',
    styleName: 'frag-status',
    text: sheetHtml(tornPolygon(STATUS_SEED), rows),
    style: `${SHEET_SHADOW}margin:0 0 10px;text-align:center;font-weight:600;color:#5b6572;break-inside:avoid;`,
    data: { toppath: tornPolygon(STATUS_SEED, { flatTop: true }) },
  }
}

// Une page de contenu : statut puis passages REÇUS (pagination faite en amont — couler
// des milliers de passages dans Paged.js le ferait ramer). `offset` = rang du 1er
// passage, pour que sa déchirure reste la sienne d'une page à l'autre.
export function fragmentPages(fragments, needle, { status, stats, offset = 0 } = {}) {
  const entries = []
  if (status != null) entries.push(statusEntry(status, stats))
  entries.push(...fragmentEntries(fragments, needle, offset))
  return [{ kind: 'content', entries }]
}
