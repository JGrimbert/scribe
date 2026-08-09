// Styles d'un VIS-À-VIS liminaire : le sous-ensemble porté par ses deux pages, dans
// l'ordre de lecture, montré par l'aside en regard de l'aperçu.

// Noms de styles d'une planche (`{ left, right }`), dédupliqués dans l'ordre d'apparition.
// Pages blanches/de garde et entrées blanches ignorées.
export function spreadStyleNames(spread) {
  const out = []
  for (const cell of [spread?.left, spread?.right]) {
    if (!cell || cell.blank || cell.cover) continue
    for (const entry of cell.page?.entries ?? []) {
      if (!entry || entry.isBlank || !entry.styleName) continue
      if (!out.includes(entry.styleName)) out.push(entry.styleName)
    }
  }
  return out
}

// Sous la forme attendue par StyleRolesTable, résolus contre l'inventaire de la zone (un
// style absent — page absorbée par un déplacement de borne — garde au moins son nom).
export function spreadStyles(spread, inventory = []) {
  const known = new Map((inventory ?? []).map((s) => [s.name, s]))
  return spreadStyleNames(spread).map((name) => known.get(name) ?? { name })
}
