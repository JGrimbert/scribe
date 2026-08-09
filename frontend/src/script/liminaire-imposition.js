// Numérotation PHYSIQUE des pages : chaque page occupe un folio numéroté
// séquentiellement. Modèle EXPLICITE (plus de parité automatique) : une blanche
// n'apparaît que si le .odt en porte une (`isBlank`) ou si le style de tête de la page
// suivante la demande (`precedes === 'blank'`, belle page). Le côté recto/verso reste
// calculé pour composer les planches mais ne contraint plus rien.
export function computeImposition(pages) {
  const slots = []
  let n = 1
  let started = false
  const parity = (num) => (num % 2 === 1 ? 'recto' : 'verso')
  for (const page of pages ?? []) {
    if (page.isBlank) {
      // Blanche avant le premier contenu = intérieur de couverture (non numérotée).
      if (!started) {
        slots.push({ number: 0, parity: 'verso', blank: true, cover: true, page })
        continue
      }
      slots.push({ number: n, parity: parity(n), blank: true, page })
      n++
      continue
    }
    // Belle page : blanche insérée avant la page (une fois le contenu commencé).
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

// Regroupe les folios en PLANCHES (livre ouvert) : la page 1 seule à droite face à
// l'intérieur de couverture, puis des paires (verso pair | recto impair).
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

// Pages RÉELLES d'un vis-à-vis (verso puis recto). Une blanche implicite (parité) n'en
// est pas une : pas de `page`, rien à découper.
export function pagesOfSpread(spread) {
  if (!spread) return []
  return [spread.left, spread.right]
    .filter((cell) => cell && !cell.cover && cell.page)
    .map((cell) => cell.page)
}
