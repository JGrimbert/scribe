import { FlatNode, HighlightUsage, StyleInventory, StyleUsage, ZoneKey } from './types'

// Ventilation de l'inventaire par ZONE du livre — la matière première du
// tableau des styles rangé dans l'ordre de lecture (liminaire, puis les
// niveaux de titre, puis l'appareil de fin) plutôt que par fréquence brute.
//
// Les zones elles-mêmes ne sont PAS calculées ici : elles sortent de
// `buildParsedResult` (hierarchy.ts), qui tient déjà la pile des titres ouverts.
// Refaire une pile ici, avec les mêmes levelOverrides et la même règle « la
// profondeur réelle est la position dans la pile, pas le numéro de niveau »,
// c'était signer pour deux logiques de profondeur qui divergeraient au premier
// cas tordu (un document qui saute un niveau, un titre rétrogradé en
// paragraphe). Une seule passe, une seule pile, une seule vérité.

// Les surlignages inline vivent dans le texte, pas dans un attribut du FlatNode
// (cf. nodeTextWithLinks) : sans les relire, la ventilation d'un surlignage
// raterait les 160 spans du témoin pour ne voir que ses 164 paragraphes.
const INLINE_MARK_RE = /<mark data-hl="([^"]+)">/g

// Profondeur d'un nœud (0 = axe) → zone. Au-delà de 2, tout est « article » :
// la typologie n'a que faire qu'un chapitre soit à 3 ou 5 niveaux de fond, et
// une zone par profondeur réelle donnerait des colonnes vides sur la plupart
// des livres.
export function zoneOfDepth(depth: number): ZoneKey {
  if (depth <= 0) return 'depth-0'
  if (depth === 1) return 'depth-1'
  return 'depth-2+'
}

function bump(byZone: Partial<Record<ZoneKey, number>>, zone: ZoneKey) {
  byZone[zone] = (byZone[zone] ?? 0) + 1
}

function textOf(node: FlatNode): string {
  return node.kind === 'list' ? (node.listItems ?? []).map((i) => i.text).join('\n') : node.text
}

/**
 * Enrichit un inventaire d'un `byZone` par style et par surlignage.
 *
 * `count` (et `paragraphs`/`spans`) ne sont PAS recalculés : ils viennent du
 * XML, qui est exhaustif, et font autorité pour `isTypologySettled`. `byZone`,
 * lui, se calcule sur les FlatNode — la vue structurelle. D'où l'invariant
 * `sum(byZone) <= count`, et non `==` : échappent à la ventilation les
 * paragraphes vides (jamais promus en FlatNode) et les paragraphes de
 * métadonnées (auteur, titre du livre, absorbés par buildFlatNodes). Ne jamais
 * dériver `count` de `byZone` : l'écran doit afficher un total exhaustif.
 */
export function ventilateInventory(
  inventory: StyleInventory,
  flatNodes: FlatNode[],
  zones: Map<number, ZoneKey>,
): StyleInventory {
  const styleZones = new Map<string, Partial<Record<ZoneKey, number>>>()
  const highlightZones = new Map<string, Partial<Record<ZoneKey, number>>>()

  const zonesFor = (map: Map<string, Partial<Record<ZoneKey, number>>>, key: string) => {
    let byZone = map.get(key)
    if (!byZone) {
      byZone = {}
      map.set(key, byZone)
    }
    return byZone
  }

  for (const node of flatNodes) {
    const zone = zones.get(node.index)
    if (!zone) continue

    if (node.effectiveStyle) bump(zonesFor(styleZones, node.effectiveStyle), zone)
    // Les paragraphes d'un tableau ou d'une liste n'ont pas de FlatNode à eux
    // (le parseur les aplatit) : sans ce relevé, « Voir » (183 usages du témoin,
    // tous en cellule) et « Puces ? » (15, tous en item) seraient ventilés à
    // zéro — comptés par l'inventaire, situés nulle part.
    for (const innerStyle of node.innerStyles ?? []) bump(zonesFor(styleZones, innerStyle), zone)

    if (node.highlight) bump(zonesFor(highlightZones, node.highlight), zone)
    for (const [, color] of textOf(node).matchAll(INLINE_MARK_RE)) {
      bump(zonesFor(highlightZones, color.toLowerCase()), zone)
    }
  }

  return {
    styles: inventory.styles.map((s): StyleUsage => ({ ...s, byZone: styleZones.get(s.name) ?? {} })),
    highlights: inventory.highlights.map((h): HighlightUsage => ({ ...h, byZone: highlightZones.get(h.color) ?? {} })),
  }
}
