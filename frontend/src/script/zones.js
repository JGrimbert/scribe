// Les zones du livre dans l'ordre de LECTURE : un style se lit d'abord par où il vit.
// Clés issues du backend (ZONE_KEYS). Palette catégorielle (--c-cat-*) et non la rampe :
// une zone est une identité, pas un palier de progression.
export const ZONES = [
  { key: 'liminaire', label: 'Liminaire', hint: 'Page de titre, auteur, dédicace, mentions légales', color: 'var(--c-cat-1)' },
  { key: 'depth-0', label: 'Chapitrage — niveau 1', hint: 'Titres de premier niveau et leur contenu propre', color: 'var(--c-cat-2)' },
  { key: 'depth-1', label: 'Chapitrage — niveau 2', hint: 'Deuxième niveau de titre', color: 'var(--c-cat-3)' },
  { key: 'depth-2+', label: 'Chapitrage — niveau 3+', hint: 'Troisième niveau et au-delà — le gros du texte', color: 'var(--c-cat-4)' },
  { key: 'final', label: 'Partie finale', hint: 'Index, glossaire, bibliographie écrits à la main', color: 'var(--c-cat-5)' },
]

// Styles que la ventilation ne situe nulle part : des paragraphes VIDES (filets,
// ornements) que le parseur ne promeut pas en nœuds mais que l'inventaire compte.
export const UNZONED = { key: 'unzoned', label: 'Non situés', hint: 'Paragraphes sans texte : filets, ornements', color: 'var(--c-border)' }

export function totalOf(byZone) {
  return Object.values(byZone ?? {}).reduce((sum, n) => sum + n, 0)
}

// Profondeur → clé de zone. Miroir de `zoneOfDepth` côté backend (au-delà de 2, tout
// est « article »).
export function zoneKeyOfDepth(depth) {
  if (depth <= 0) return 'depth-0'
  if (depth === 1) return 'depth-1'
  return 'depth-2+'
}

// Zones correspondant à un niveau de titre (celles qui ont des nœuds, donc une forme).
export const STRUCTURE_ZONES = ZONES.filter((z) => z.key.startsWith('depth-'))

// La zone où un style pèse le plus. Égalité départagée par l'ordre de lecture (stable),
// pas par l'ordre des clés d'un objet (que Postgres ne préserve pas, cf. jsonb).
export function dominantZone(byZone) {
  let best = null
  for (const zone of ZONES) {
    const value = byZone?.[zone.key] ?? 0
    if (value > 0 && (!best || value > best.value)) best = { key: zone.key, value }
  }
  return best?.key ?? UNZONED.key
}

export function zoneSegments(byZone) {
  return ZONES.map((zone) => ({ key: zone.key, value: byZone?.[zone.key] ?? 0, color: zone.color, label: zone.label }))
}

// Range chaque style dans SA zone dominante, une seule fois (la ligne porte le v-model
// du rôle : un style en double donnerait deux contrôles pour une décision). Sections
// vides omises.
export function groupByZone(styles) {
  const sections = [...ZONES, UNZONED].map((zone) => ({ zone, styles: [] }))
  const byKey = new Map(sections.map((s) => [s.zone.key, s]))

  for (const style of styles) {
    byKey.get(dominantZone(style.byZone))?.styles.push(style)
  }

  for (const section of sections) {
    // Ordre d'apparition (`firstIndex`) quand l'inventaire le porte ; repli sur le
    // poids dans la zone puis le count global (imports avant `firstIndex`).
    section.styles.sort((a, b) => {
      if (a.firstIndex != null && b.firstIndex != null) return a.firstIndex - b.firstIndex
      const inZone = (s) => s.byZone?.[section.zone.key] ?? 0
      return inZone(b) - inZone(a) || b.count - a.count
    })
  }

  return sections.filter((s) => s.styles.length)
}

// Document importé avant la ventilation (.odt non conservé) : on retombe sur le tableau
// plat historique plutôt que de tout empiler dans « Non situés » (mensonge par omission).
export function hasZones(styles) {
  return styles.some((s) => totalOf(s.byZone) > 0)
}
