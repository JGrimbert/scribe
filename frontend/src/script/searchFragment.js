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

export function tornPolygon(seed) {
  const rand = rng(seed + 1)
  const top = []
  const bottom = []
  for (let i = 0; i <= TEETH; i++) {
    const x = ((i / TEETH) * 100).toFixed(2)
    top.push(`${x}% ${(i % 2 ? 0 : 1 + rand() * TOOTH).toFixed(1)}px`)
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

// Une entrée d'imposition par lambeau : le texte du passage, sa source en second
// paragraphe, et le style qui le découpe. Le `style` est appliqué en inline sur le
// bloc par useFolioFrame — c'est la voie par laquelle le clip-path arrive dans la
// page sans que FolioView connaisse la recherche.
export function fragmentEntries(fragments, needle, offset = 0) {
  return fragments.flatMap((f, i) => [
    {
      type: 'paragraph',
      styleName: 'frag',
      text: fragmentHtml(f.phrase, needle),
      // `break-inside: avoid` : un lambeau coupé entre deux pages verrait sa
      // découpe tranchée net au milieu. Il passe entier ou il passe à la suite.
      style: `background:#fff;clip-path:${tornPolygon(offset + i)};padding:10px 12px 8px;margin:0 0 10px;text-align:justify;break-inside:avoid;`,
    },
    {
      type: 'paragraph',
      styleName: 'frag-source',
      text: escapeHtml(f.path ? `${f.path} › ${f.titre}` : f.titre),
      // La source appartient à son lambeau : elle ne doit pas ouvrir une page.
      style: 'background:#fff;padding:0 12px 8px;margin:-10px 0 14px;font-size:.8em;color:#8a7f72;text-align:left;break-before:avoid;break-inside:avoid;',
    },
  ])
}

// Découpe des lambeaux en pages d'imposition (une planche = deux pages).
export function fragmentSpread(fragments, needle) {
  const half = Math.ceil(fragments.length / 2)
  return [
    { kind: 'content', entries: fragmentEntries(fragments.slice(0, half), needle, 0) },
    { kind: 'content', entries: fragmentEntries(fragments.slice(half), needle, half) },
  ]
}
