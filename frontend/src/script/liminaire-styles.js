// Styles d'un VIS-À-VIS liminaire. Le chapitrage a une table par niveau (les
// styles de sa zone) ; une planche liminaire, elle, ne porte que les styles de ses
// deux pages — c'est ce sous-ensemble, dans l'ordre où il se lit, que l'aside
// montre en regard de l'aperçu.

// Noms de styles portés par une planche (`{ left, right }`, cf. computeImposition),
// dédupliqués dans l'ordre d'apparition : page de gauche puis de droite. Les pages
// blanches/de garde n'ont pas d'entrées, les entrées blanches (respirations du
// .odt) ne portent rien à styler.
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

// Les mêmes styles sous la forme attendue par StyleRolesTable (`{ name, … }`),
// résolus contre l'INVENTAIRE de la zone pour garder ce que la table en sait
// (échantillon, style déclaré à la main). Un style absent de l'inventaire — page
// absorbée par un déplacement de borne — garde au moins son nom.
export function spreadStyles(spread, inventory = []) {
  const known = new Map((inventory ?? []).map((s) => [s.name, s]))
  return spreadStyleNames(spread).map((name) => known.get(name) ?? { name })
}
