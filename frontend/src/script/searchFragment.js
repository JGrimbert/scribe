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
      // Variante haut-plat, pré-calculée : appliquée par useFolioFrame au lambeau
      // qui, APRÈS pagination, s'est retrouvé en tête de page (bord franc). Stampée
      // en data-attribute → le rendu la pose sans recalculer ni connaître la graine.
      data: { toppath: tornPolygon(offset + i, { flatTop: true }) },
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

// Graine dédiée au lambeau de statut : hors de la plage des résultats (0..n-1) pour
// que sa déchirure ne recopie pas celle du premier passage.
const STATUS_SEED = 9973

// Lambeau de STATUT : toujours en tête, porte le compte (« 0 résultat » →
// « N résultats »), même look de papier déchiré que les passages. Étant en tête de
// page, useFolioFrame lui posera son haut plat (data.toppath).
export function statusEntry(status) {
  return {
    type: 'paragraph',
    styleName: 'frag-status',
    text: escapeHtml(status),
    style: `background:#fff;clip-path:${tornPolygon(STATUS_SEED)};padding:12px;margin:0 0 10px;text-align:center;font-weight:600;color:#5b6572;break-inside:avoid;`,
    data: { toppath: tornPolygon(STATUS_SEED, { flatTop: true }) },
  }
}

// UN SEUL flux de contenu : le lambeau de statut puis TOUS les passages. Paged.js
// pagine ce flux en autant de pages que nécessaire (les résultats débordent, ils ne
// sont plus capés à une double page). `status` absent = pas de carte de statut.
export function fragmentPages(fragments, needle, { status } = {}) {
  const entries = []
  if (status != null) entries.push(statusEntry(status))
  entries.push(...fragmentEntries(fragments, needle, 0))
  return [{ kind: 'content', entries }]
}
