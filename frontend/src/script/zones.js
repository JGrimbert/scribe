// Les zones du livre, dans l'ORDRE DE LECTURE — c'est tout l'intérêt : un style
// se lit d'abord par où il vit. « Dédicace » n'est pas un style rare, c'est un
// style liminaire ; « Voir » n'est pas un style fréquent, c'est un style
// d'article. Un tableau trié par fréquence brute ne dit ni l'un ni l'autre.
//
// Les clés viennent du backend (ZONE_KEYS, odt-parser/types.ts) ; les
// profondeurs ≥ 2 y sont déjà regroupées sous « depth-2+ ».
//
// Palette CATÉGORIELLE (--c-cat-*) et non la rampe : une zone est une identité,
// pas un palier. Colorier ces zones en --c-ramp-* les ferait lire comme une
// progression (« de plus en plus profond = de plus en plus rédigé »), ce qui
// est faux.
export const ZONES = [
  { key: 'liminaire', label: 'Liminaire', hint: 'Page de titre, auteur, dédicace, mentions légales', color: 'var(--c-cat-1)' },
  { key: 'depth-0', label: 'Chapitrage — niveau 1', hint: 'Titres de premier niveau et leur contenu propre', color: 'var(--c-cat-2)' },
  { key: 'depth-1', label: 'Chapitrage — niveau 2', hint: 'Deuxième niveau de titre', color: 'var(--c-cat-3)' },
  { key: 'depth-2+', label: 'Chapitrage — niveau 3+', hint: 'Troisième niveau et au-delà — le gros du texte', color: 'var(--c-cat-4)' },
  { key: 'final', label: 'Partie finale', hint: 'Index, glossaire, bibliographie écrits à la main', color: 'var(--c-cat-5)' },
]

// Les styles que la ventilation ne situe nulle part. Ce ne sont pas des
// anomalies : ce sont, sur le manuscrit témoin, des paragraphes VIDES — filets,
// ornements, sauts. Le parseur ne les promeut pas en nœuds (ils n'ont pas de
// texte), mais l'inventaire les compte, lui, parce que l'auteur les a bel et
// bien posés. D'où une section à part plutôt qu'un silence.
export const UNZONED = { key: 'unzoned', label: 'Non situés', hint: 'Paragraphes sans texte : filets, ornements', color: 'var(--c-border)' }

export function totalOf(byZone) {
  return Object.values(byZone ?? {}).reduce((sum, n) => sum + n, 0)
}

// Profondeur d'un nœud → clé de zone. Miroir de `zoneOfDepth` côté backend
// (odt-parser/zones.ts) : au-delà de 2, tout est « article ». Sert à ranger les
// modèles de structure sous les mêmes intitulés et les mêmes couleurs que le
// tableau des styles — un « Article » doit être le même objet dans les deux.
export function zoneKeyOfDepth(depth) {
  if (depth <= 0) return 'depth-0'
  if (depth === 1) return 'depth-1'
  return 'depth-2+'
}

// Les zones qui correspondent à un niveau de titre — celles qui ont des nœuds,
// donc une forme. Le liminaire et le final n'en sont pas : ce ne sont pas des
// nœuds de l'arbre.
export const STRUCTURE_ZONES = ZONES.filter((z) => z.key.startsWith('depth-'))

// La zone où un style pèse le plus. En cas d'égalité, l'ordre de lecture
// tranche — arbitraire mais stable, plutôt que l'ordre des clés d'un objet
// (que Postgres ne préserve pas, cf. les colonnes jsonb).
export function dominantZone(byZone) {
  let best = null
  for (const zone of ZONES) {
    const value = byZone?.[zone.key] ?? 0
    if (value > 0 && (!best || value > best.value)) best = { key: zone.key, value }
  }
  return best?.key ?? UNZONED.key
}

// Les segments d'une barre de répartition, dans l'ordre de lecture.
export function zoneSegments(byZone) {
  return ZONES.map((zone) => ({ key: zone.key, value: byZone?.[zone.key] ?? 0, color: zone.color, label: zone.label }))
}

/**
 * Range chaque style dans SA zone dominante — une seule fois, jamais dupliqué :
 * la ligne porte le `v-model` du rôle, et un style présent dans deux sections
 * donnerait deux contrôles pour une seule décision. La répartition réelle se lit
 * dans la barre, pas dans la duplication.
 *
 * Les sections vides sont omises. Chaque style est trié par son poids DANS la
 * zone (ce qui justifie sa place), `count` global en départage.
 */
export function groupByZone(styles) {
  const sections = [...ZONES, UNZONED].map((zone) => ({ zone, styles: [] }))
  const byKey = new Map(sections.map((s) => [s.zone.key, s]))

  for (const style of styles) {
    byKey.get(dominantZone(style.byZone))?.styles.push(style)
  }

  for (const section of sections) {
    section.styles.sort((a, b) => {
      // Ordre d'apparition dans le document quand l'inventaire le porte
      // (`firstIndex`, ajouté côté backend) : un style se lit dans l'ordre où on
      // le rencontre, pas par fréquence. Repli sur le poids dans la zone puis le
      // count global pour les documents importés avant `firstIndex`.
      if (a.firstIndex != null && b.firstIndex != null) return a.firstIndex - b.firstIndex
      const inZone = (s) => s.byZone?.[section.zone.key] ?? 0
      return inZone(b) - inZone(a) || b.count - a.count
    })
  }

  return sections.filter((s) => s.styles.length)
}

// Un document importé avant la ventilation : le .odt n'étant pas conservé, seul
// un réimport la remplit. On retombe alors sur le tableau plat historique plutôt
// que de tout empiler dans « Non situés », ce qui serait un mensonge par
// omission — ces styles ont une zone, on ne la connaît pas.
export function hasZones(styles) {
  return styles.some((s) => totalOf(s.byZone) > 0)
}
