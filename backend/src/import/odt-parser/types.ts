export interface Stats {
  mots: number
  caracteres: number
  paragraphes: number
  status: 'vide' | 'ébauche' | 'partiel' | 'rédigé'
}

// Un item de liste ODT (text:list-item), à plat : `depth` (0 = premier
// niveau) remplace l'imbrication réelle des <text:list> ODT — convention
// alignée sur celle de Quill 2 pour les listes imbriquées (classes
// `ql-indent-N` sur des <li> à plat, jamais de <ul>/<ol> imbriqués), pour
// que le format round-trip sans traduction supplémentaire côté édition.
export interface ListItemEntry {
  text: string
  depth: number
}

// Une entrée de `texte[]` : soit un paragraphe simple (comportement
// historique), soit une liste entière (tous ses items) traitée comme UN
// seul bloc — cf. backend/CLAUDE.md et le plan "Articles par nœud" pour la
// justification (minimise l'impact sur la logique de fusion/split
// frontend, qui reste par-entrée).
// `styleName` (style effectif, résolu et décodé) et `highlight` (surlignage du
// paragraphe entier) voyagent avec l'entrée jusqu'en base : c'est la clé qui
// permet à la typologie de dire ce qu'est ce paragraphe. Optionnels — les
// documents importés avant leur introduction n'en ont pas, et le .odt n'étant
// pas conservé, seule une réimportation les remplit.
export type TexteEntry =
  | { type: 'paragraph'; text: string; styleName?: string; highlight?: string | null }
  | { type: 'list'; ordered: boolean; items: ListItemEntry[]; styleName?: string; highlight?: string | null }

// Un nœud de titre, à n'importe quelle profondeur (remplace les anciens
// ParsedAxe/ParsedBloc/ParsedArticle distincts). `texte` est le contenu
// propre à ce nœud, avant son premier enfant ; `children` porte la suite de
// la hiérarchie.
export interface ParsedNode {
  titre: string
  slug: string
  numeroRomain: string | null
  texte: TexteEntry[]
  citations: string[]
  pistes: string[]
  tableau: string[][] | null
  children: ParsedNode[]
  stats: Stats | null
  indexGlobal: number | null
}

export interface ParsedResult {
  inventory: StyleInventory
  meta: {
    parsedAt: string
    totalNodes: number
    auteur?: string
    titreLivre?: string
    totalArticles: number // nœuds de profondeur >= 2 (généralisation : "tout ce qui est sous un bloc")
    totalBlocs: number // nœuds de profondeur 1
    totalAxes: number // nœuds racine (profondeur 0)
    maxDepth: number
    paragraphesPreambule: number
    sectionsRencontrees: number
    titresVides: number
  }
  preambule: string[]
  axes: ParsedNode[]
}

export interface HarmonizedItem {
  id: string
  level: number // profondeur (0 = racine), remplace l'ancien type 'axe'|'bloc'|'article'
  titre: string
  slug: string
  texte: TexteEntry[]
  connexe: { tableau: string[][] | null; pistes: string[] } | null
  indexGlobal: number | null
  stats: Omit<Stats, 'status' | 'paragraphes'> | null
}

export type DataMap = Record<string, HarmonizedItem>

export interface TrameNode {
  id: string
  children: TrameNode[]
}

export interface Trame {
  meta: ParsedResult['meta']
  preambule: string[]
  axes: TrameNode[]
}

export interface OdtParseOutput {
  result: ParsedResult
  data: DataMap
  trame: Trame
}

// ─── Calibration : titres candidats + corrections utilisateur ─────────────
//
// La détection automatique du niveau de titre (headingLevel, cf. plus bas)
// se fie au nom du style ODT (Titre 1/2/3, Heading 1/2/3). Sur un document
// réel où certains titres sont mis en forme directement (styles "Pxxx"
// auto-générés par LibreOffice) plutôt que via un style nommé, cette
// détection peut se tromper silencieusement (un axe entier rétrogradé en
// bloc). FlatNode/OutlineEntry séparent donc la lecture du XML (une seule
// fois) de la construction de la structure imbriquée, pour permettre de
// rejouer cette dernière avec des corrections manuelles sans re-parser le
// fichier.
export interface FlatNode {
  index: number
  kind: 'heading' | 'paragraph' | 'table' | 'list'
  level: number // détecté automatiquement ; seulement pertinent si kind === 'heading'
  text: string
  // Nom BRUT du style ODT (« P26 », « Heading_20_3 »). Reste la source de la
  // détection de niveau (headingLevel) : ne pas y substituer effectiveStyle,
  // ça changerait la structure détectée à l'import.
  styleName: string
  // Style RÉEL derrière le style automatique, décodé (« Paragraphes »,
  // « Citation paragraphe »). C'est lui que voit la typologie — les noms bruts
  // sont 10x plus nombreux et ne veulent rien dire.
  effectiveStyle: string
  // Surlignage portant sur le paragraphe ENTIER (fo:background-color du style).
  // Distinct des <mark data-hl> inline, qui vivent dans `text`.
  highlight: string | null
  hasPageBreak: boolean // fo:break-before forcé sur le style de ce nœud
  tableData?: string[][]
  listItems?: ListItemEntry[] // pertinent si kind === 'list'
  listOrdered?: boolean // pertinent si kind === 'list'
  bookmarkNames?: string[] // signets ODT rattachés à ce titre ; pertinent si kind === 'heading'
}

// ─── Inventaire des styles — matière première de la typologie ─────────────
//
// Deux inventaires séparés parce qu'ils se configurent séparément : un style
// porte un RÔLE structurel (« Citation paragraphe » = citation), une couleur
// de surlignage porte une INTENTION d'annotation (« à reprendre »). Un même
// paragraphe peut avoir les deux.

export interface StyleUsage {
  name: string // style effectif décodé
  count: number
  headings: number // combien de ces occurrences sont des titres — un style à cheval est suspect
  sample: string // extrait du premier usage non vide, pour reconnaître le style sans rouvrir l'ODT
}

export interface HighlightUsage {
  color: string // #rrggbb, tel quel — le sens est affaire de configuration
  paragraphs: number // paragraphes entiers surlignés
  spans: number // surlignages inline
  sample: string
}

export interface StyleInventory {
  styles: StyleUsage[] // triés par fréquence décroissante
  highlights: HighlightUsage[]
}

export interface OutlineEntry {
  index: number
  level: number
  text: string
  empty: boolean
  hasPageBreak: boolean
}

export interface ImportCorrections {
  // Index (dans FlatNode[]) du premier nœud appartenant à la vraie structure.
  // Tout ce qui précède (page de titre, auteur, sommaire...) part en
  // préambule, quel que soit le niveau de titre détecté dessus.
  structureStartIndex: number
  // Niveau corrigé pour un titre mal détecté, par index de FlatNode.
  // 0 = "ignorer" (rétrograder en simple paragraphe).
  levelOverrides?: Record<number, number>
}
