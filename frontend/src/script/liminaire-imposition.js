// Numérotation PHYSIQUE des pages, façon imposition : chaque page occupe un
// folio, numéroté séquentiellement. Plus de parité recto/verso automatique — le
// modèle est EXPLICITE : une page blanche n'apparaît que si le .odt en porte une
// (page `isBlank`) ou si le STYLE de tête de la page suivante la demande
// (`precedes === 'blank'`, une belle page). Le côté recto/verso reste calculé
// (impair/pair) pour composer les planches, mais ne CONTRAINT plus rien.
export function computeImposition(pages) {
  const slots = []
  let n = 1
  let started = false
  const parity = (num) => (num % 2 === 1 ? 'recto' : 'verso')
  for (const page of pages ?? []) {
    if (page.isBlank) {
      // Blanche AVANT le premier contenu = intérieur de couverture (non
      // numérotée) : sans quoi elle prendrait la page 1.
      if (!started) {
        slots.push({ number: 0, parity: 'verso', blank: true, cover: true, page })
        continue
      }
      slots.push({ number: n, parity: parity(n), blank: true, page })
      n++
      continue
    }
    // Belle page : le style de tête demande une blanche AVANT sa page. Insérée
    // telle quelle (une seule, explicite), une fois le contenu commencé — avant
    // lui, c'est la couverture qui joue ce rôle.
    if (started && page.precedes === 'blank') {
      slots.push({ number: n, parity: parity(n), blank: true, implicit: true })
      n++
    }
    started = true
    slots.push({ number: n, parity: parity(n), blank: false, page })
    n++
  }
  return slots
}

// Regroupe les folios en PLANCHES telles qu'on les voit dans un livre ouvert :
// la page 1 (recto) est seule à droite, face à l'intérieur de couverture (la
// dernière blanche de tête, si présente) ; ensuite des paires (verso pair à
// gauche | recto impair à droite).
export function toSpreads(slots) {
  const byNum = new Map(slots.filter((s) => !s.cover).map((s) => [s.number, s]))
  const covers = slots.filter((s) => s.cover)
  const cover = covers.length ? covers[covers.length - 1] : null
  const max = byNum.size ? Math.max(...byNum.keys()) : 0
  const spreads = []
  if (max >= 1 || cover) spreads.push({ left: cover, right: byNum.get(1) ?? null })
  for (let e = 2; e <= max; e += 2) spreads.push({ left: byNum.get(e) ?? null, right: byNum.get(e + 1) ?? null })
  return spreads
}

// Les pages RÉELLES d'un vis-à-vis, dans l'ordre verso puis recto. Une blanche
// implicite (insérée pour la parité) n'en est pas une : elle ne porte pas de
// `page`, elle ne vient d'aucune entrée du .odt et ne se découpe donc pas.
export function pagesOfSpread(spread) {
  if (!spread) return []
  return [spread.left, spread.right]
    .filter((cell) => cell && !cell.cover && cell.page)
    .map((cell) => cell.page)
}
