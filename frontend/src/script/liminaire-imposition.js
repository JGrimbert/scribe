// Le côté EFFECTIF d'une page pour la composition, par ordre d'autorité :
//  1. `side` CHOISI par l'utilisateur (config.side) — il tranche ;
//  2. `sideFromOdt` — le côté RÉEL lu du .odt (ground truth de CE document) ;
//  3. `typeSide` — la CONVENTION du type tagué (faux-titre=recto, mentions=verso…),
//     l'ancre de parité : sans elle, taguer une page ne la place nulle part et le
//     liminaire dérive. Le composer la fournit depuis LIMINAIRE_PAGES[].side.
// 'auto' = libre (la parité coule).
export function effectiveSide(page) {
  if (page?.side && page.side !== 'auto') return page.side
  if (page?.sideFromOdt && page.sideFromOdt !== 'auto') return page.sideFromOdt
  return page?.typeSide && page.typeSide !== 'auto' ? page.typeSide : 'auto'
}

// Numérotation PHYSIQUE des pages, façon imposition : chaque page occupe un
// folio ; une page contrainte à un côté (recto = impair / verso = pair) qui
// tomberait du mauvais côté fait insérer une page blanche IMPLICITE avant elle
// pour rétablir la parité — sauf si la précédente est déjà blanche (règle
// « deux sauts consécutifs → une seule blanche »). Les pages doivent porter un
// `side` effectif (cf. effectiveSide).
export function computeImposition(pages) {
  const slots = []
  let n = 1
  let started = false
  const parity = (num) => (num % 2 === 1 ? 'recto' : 'verso')
  for (const page of pages ?? []) {
    if (page.isBlank) {
      // Blanche AVANT le premier contenu = intérieur de couverture (non
      // numérotée) : sans quoi elle prendrait la page 1 et pousserait le
      // faux-titre en verso, alors qu'il doit être recto.
      if (!started) {
        slots.push({ number: 0, parity: 'verso', blank: true, cover: true, page })
        continue
      }
      slots.push({ number: n, parity: parity(n), blank: true, page })
      n++
      continue
    }
    started = true
    const want = effectiveSide(page)
    if (want !== 'auto' && parity(n) !== want) {
      const prev = slots[slots.length - 1]
      if (prev && prev.blank && !prev.cover) {
        // Une blanche précède ET la parité est fausse : elle est mal placée. On
        // l'ABSORBE (au lieu d'en ajouter une seconde, ce qui ferait deux
        // blanches d'affilée) — la page reprend son numéro et retombe sur son
        // côté conventionnel. C'est « la convention l'emporte sur les blanches
        // du .odt » : Writer pose des blanches sans connaître nos types.
        slots.pop()
        n--
      } else {
        slots.push({ number: n, parity: parity(n), blank: true, implicit: true })
        n++
      }
    }
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
