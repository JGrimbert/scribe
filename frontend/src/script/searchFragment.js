// Lambeaux de recherche : le rendu d'un passage trouvé, sous la forme d'entrées
// d'imposition (cf. buildImpositionBlocks). Les fragments coulent donc dans le
// MÊME FolioView que les autres vues de la maquette — pas de gabarit parallèle —
// avec pour seule particularité un fond blanc et un bord déchiré par lambeau,
// posés en style inline sur le bloc (la page, elle, reste transparente).

// Dents du déchirement : X en %, Y en px — une dent doit garder la même hauteur
// quelle que soit la longueur du passage.
const TEETH = 11
const TOOTH = 7

// Générateur déterministe (mulberry32) : même graine, même déchirure. Sans graine,
// le papier se redécouperait à chaque frappe.
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

// `flatTop` : haut plat (ligne franche à 0), le bas restant déchiré. Le lambeau en
// TÊTE de page (bord franc contre le bord de page) l'emploie. On CONTINUE de tirer
// les mêmes `rand()` sur les indices pairs même quand on aplatit, sinon les dents du
// BAS se décaleraient — la variante plate doit garder le même bas que la déchirée.
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

// Repli des accents, identique à celui de la recherche : on compare sur la forme
// repliée et on RESTITUE le texte d'origine.
const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Passage borné de […] (le lambeau est une découpe, il le dit) avec la saisie en
// gras. Rendu en HTML : il part dans le flow de l'iframe Paged.js.
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

// Ombre du papier, identique à celle des pages Paged.js (cf. le boot de
// useFolioFrame). En `drop-shadow` et non `box-shadow` : elle doit épouser la
// DÉCOUPE du lambeau, et un box-shadow serait de toute façon rogné par le
// clip-path (l'ordre de rendu est filter → clip-path).
const SHEET_SHADOW = 'filter:drop-shadow(0 1px 6px rgba(0,0,0,.15));'
// Même ombre pour la source, mais décalée vers le bas : elle chevauche le bas du
// lambeau (margin négative) et une ombre centrée retomberait sur lui en liseré.
const SOURCE_SHADOW = 'filter:drop-shadow(0 4px 5px rgba(0,0,0,.15));'

// Une entrée d'imposition par lambeau : le texte du passage, sa source en second
// paragraphe, et le style qui le découpe. Le `style` est appliqué en inline sur le
// bloc par useFolioFrame — c'est la voie par laquelle le clip-path arrive dans la
// page sans que FolioView connaisse la recherche.
//
// DEUX boîtes par lambeau : le bloc porte l'ombre, la feuille interne
// (`.frag-sheet`) le papier et sa découpe. Un seul élément ne peut pas faire les
// deux — le clip-path taillerait l'ombre avec le papier.
export function fragmentEntries(fragments, needle, offset = 0) {
  return fragments.flatMap((f, i) => [
    {
      type: 'paragraph',
      styleName: 'frag',
      text: sheetHtml(tornPolygon(offset + i), fragmentHtml(f.phrase, needle)),
      // `break-inside: avoid` : un lambeau coupé entre deux pages verrait sa
      // découpe tranchée net au milieu. Il passe entier ou il passe à la suite.
      style: `${SHEET_SHADOW}margin:0 0 10px;text-align:justify;break-inside:avoid;`,
      // Variante haut-plat, pré-calculée : appliquée par useFolioFrame à la feuille
      // qui, APRÈS pagination, s'est retrouvée en tête de page (bord franc). Stampée
      // en data-attribute → le rendu la pose sans recalculer ni connaître la graine.
      data: { toppath: tornPolygon(offset + i, { flatTop: true }) },
    },
    {
      type: 'paragraph',
      styleName: 'frag-source',
      text: escapeHtml(f.path ? `${f.path} › ${f.titre}` : f.titre),
      // La source appartient à son lambeau : elle ne doit pas ouvrir une page.
      style: `${SOURCE_SHADOW}background:#fff;padding:0 12px 8px;margin:-10px 0 14px;font-size:.8em;color:#8a7f72;text-align:left;break-before:avoid;break-inside:avoid;`,
    },
  ])
}

// La feuille de papier d'un lambeau : fond, découpe et respiration du texte. Le
// padding est repris par la passe post-pagination quand la feuille ouvre une page
// (cf. FRAG_TOP_PAD, useFolioFrame).
function sheetHtml(clip, inner) {
  return `<span class="frag-sheet" style="display:block;background:#fff;clip-path:${clip};padding:10px 12px 8px;">${inner}</span>`
}

// Graine dédiée au lambeau de statut : hors de la plage des résultats (0..n-1) pour
// que sa déchirure ne recopie pas celle du premier passage.
const STATUS_SEED = 9973

// Rangée des CHIFFRES du document (cf. useDocStats) : elle vit dans le lambeau de
// statut et non plus dans le dock — la recherche porte son propre en-tête. Tuiles
// `{ label, value, empty }` rendues en ligne, valeur appuyée, libellé en retrait.
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

// Lambeau de STATUT : toujours en tête, même look de papier déchiré que les
// passages. Deux rangées — les chiffres du document, puis le compte de résultats.
// Étant en tête de page, useFolioFrame lui posera son haut plat (data.toppath).
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

// UNE page de contenu : le lambeau de statut puis les passages REÇUS. La pagination
// est faite EN AMONT (l'appelant ne passe qu'une tranche) : couler les milliers de
// passages d'un mot courant dans Paged.js le fait ramer pour n'en montrer que huit.
// `status` absent = pas de carte de statut ; `stats` = les chiffres du document,
// rangée de tête du même lambeau ; `offset` = rang du 1er passage de la tranche,
// pour que sa déchirure reste la sienne d'une page à l'autre.
export function fragmentPages(fragments, needle, { status, stats, offset = 0 } = {}) {
  const entries = []
  if (status != null) entries.push(statusEntry(status, stats))
  entries.push(...fragmentEntries(fragments, needle, offset))
  return [{ kind: 'content', entries }]
}
