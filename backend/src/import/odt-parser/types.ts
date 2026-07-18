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
// `pageStart` voyage aussi jusqu'en base (Json liminaire/final) : c'est la
// contrainte de composition — recto/verso, ou simple saut — lue du .odt. Le
// bloc éligibilité du liminaire s'en sert pour découper les pages et calculer
// le vis-à-vis. Omis (comme highlight) quand il n'y a rien à dire.
export type TexteEntry =
  | { type: 'paragraph'; text: string; styleName?: string; highlight?: string | null; pageStart?: PageStart | null }
  | { type: 'list'; ordered: boolean; items: ListItemEntry[]; styleName?: string; highlight?: string | null; pageStart?: PageStart | null }

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
    paragraphesLiminaire: number
    paragraphesFinal: number
    sectionsRencontrees: number
    titresVides: number
  }
  // Les deux bouts du livre qui ne sont pas de la structure : page de titre,
  // auteur, dédicace d'un côté ; table des matières, index, glossaire de
  // l'autre. Des TexteEntry et non des string[] : ils portent styleName et
  // highlight, sans quoi la typologie n'a rien à dire de ces zones — c'était
  // précisément le trou de l'ancien `preambule: string[]`.
  liminaire: TexteEntry[]
  final: TexteEntry[]
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
  liminaire: TexteEntry[]
  final: TexteEntry[]
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
// Composition de page d'un nœud : simple saut, ou contrainte de côté (page
// impaire = recto / paire = verso) — voir FlatNode.pageStart.
export type PageStart = 'page' | 'recto' | 'verso'

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
  // Composition de page imposée par le style du nœud, résolue par HÉRITAGE :
  //  - 'recto'/'verso' : démarre forcément sur une page impaire/paire
  //    (style:master-page-name → page-usage right/left). C'est le mécanisme
  //    « page vide » d'OpenOffice : le traitement de texte insère une page
  //    blanche pour tenir la parité, il ne la stocke pas comme contenu. Le
  //    signal vit sur le style NOMMÉ (« Heading 1 » → recto) autant que sur un
  //    style automatique, d'où la résolution par la chaîne de parents.
  //  - 'page' : simple saut de page (fo:break-before "page", ou un
  //    master-page-name vide — le saut « sans changement de style » d'OpenOffice).
  //  - null : rien.
  // Une contrainte de CÔTÉ prime un simple saut où qu'elle soit dans la chaîne
  // (un axe qui porte aussi un fo:break-before "page" reste recto).
  pageStart: PageStart | null
  tableData?: string[][]
  // Styles effectifs des paragraphes que ce nœud APLATIT : les cellules d'un
  // tableau, les items d'une liste. Un par paragraphe, répétitions comprises
  // (c'est un relevé d'usages, pas un ensemble).
  //
  // `tableData` et `listItems` ne gardent que du texte : un style qui ne vit que
  // là serait invisible de toute analyse assise sur les FlatNode. Sur le témoin,
  // deux cas réels — « Voir » (183 usages, tous en cellule) et « Puces ? » (15
  // usages, tous en item de liste).
  innerStyles?: string[]
  listItems?: ListItemEntry[] // pertinent si kind === 'list'
  listOrdered?: boolean // pertinent si kind === 'list'
  bookmarkNames?: string[] // signets ODT rattachés à ce titre ; pertinent si kind === 'heading'
  // Pages BLANCHES qui précèdent immédiatement ce nœud : des paragraphes VIDES
  // porteurs d'un pageStart (la « page vide » verso d'OpenOffice, l'intérieur de
  // couverture…). On ne les promeut pas en nœuds (ils casseraient l'invariant
  // `sum(byZone) <= count` et décaleraient les index de calibration), mais on ne
  // les jette plus : dans le liminaire/final ils deviennent des entrées « page
  // blanche » (le signal recto/verso le plus fiable du liminaire) ; dans le
  // corps ils sont ignorés.
  blanksBefore?: PageStart[]
}

// ─── Inventaire des styles — matière première de la typologie ─────────────
//
// Deux inventaires séparés parce qu'ils se configurent séparément : un style
// porte un RÔLE structurel (« Citation paragraphe » = citation), une couleur
// de surlignage porte une INTENTION d'annotation (« à reprendre »). Un même
// paragraphe peut avoir les deux.

// Les zones du livre, dans l'ordre de lecture. Un style se lit d'abord par où
// il vit : « Dédicace » n'est pas rare, il est liminaire. Les profondeurs sont
// regroupées à partir de 2 (cf. zoneOfDepth).
export const ZONE_KEYS = ['liminaire', 'depth-0', 'depth-1', 'depth-2+', 'final'] as const

export type ZoneKey = (typeof ZONE_KEYS)[number]

// Combien d'usages dans chaque zone. Partiel : une zone absente vaut zéro, et
// la somme peut être INFÉRIEURE à `count` (cf. ventilateInventory). Vide pour
// un document importé avant la ventilation — le .odt n'étant pas conservé, seul
// un réimport le remplit.
export type ZoneCounts = Partial<Record<ZoneKey, number>>

export interface StyleUsage {
  name: string // style effectif décodé
  count: number
  headings: number // combien de ces occurrences sont des titres — un style à cheval est suspect
  sample: string // extrait du premier usage non vide, pour reconnaître le style sans rouvrir l'ODT
  firstIndex?: number // rang de première apparition dans le document (ordre de lecture) — l'écran de config trie dessus ; optionnel : absent des inventaires persistés avant son ajout
  byZone?: ZoneCounts
}

export interface HighlightUsage {
  color: string // #rrggbb, tel quel — le sens est affaire de configuration
  paragraphs: number // paragraphes entiers surlignés
  spans: number // surlignages inline
  sample: string
  // Paragraphes ET spans confondus : ici on veut la répartition, le détail des
  // deux formes se lit déjà dans les colonnes voisines.
  byZone?: ZoneCounts
}

// Ce à quoi un style RESSEMBLE, résolu sur toute sa chaîne d'héritage. Le
// parseur ne capturait jusqu'ici aucune propriété visuelle : il ne lisait que
// `content.xml`, où les styles nommés (« Titre 1 », « Corps de texte ») n'ont
// qu'un nom — leurs propriétés vivent dans `styles.xml`.
//
// Valeurs rendues TELLES QUELLES (« 12pt », « 2.401cm », « 115% »), sans
// conversion : le frontend les pose en CSS, où elles sont déjà valides. Les
// convertir en px ici supposerait de fixer un DPI que seul l'affichage connaît.
export interface StyleVisual {
  fontFamily?: string
  fontSize?: string
  bold?: boolean
  italic?: boolean
  color?: string
  align?: string // start | center | end | justify
  marginTop?: string
  marginBottom?: string
  textIndent?: string
  lineHeight?: string
  pageBreakBefore?: boolean
}

// Le format de page du livre, lu sur le master-page « Standard ». Sans lui, une
// vignette est au mauvais ratio — et ça se voit immédiatement. Le témoin est en
// A5 (14,801 × 21,001 cm), pas en A4 : la valeur par défaut de la couche Folio.
export interface PageFormat {
  widthCm: number
  heightCm: number
  marginTopCm: number
  marginBottomCm: number
  marginLeftCm: number
  marginRightCm: number
}

export interface StyleInventory {
  styles: StyleUsage[] // triés par fréquence décroissante
  highlights: HighlightUsage[]
  // Indexé par nom de style EFFECTIF (même clé que `StyleUsage.name`).
  // Absent d'un document importé avant la lecture de styles.xml.
  visuals?: Record<string, StyleVisual>
  page?: PageFormat
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
  // liminaire, quel que soit le niveau de titre détecté dessus.
  structureStartIndex: number
  // Index (dans FlatNode[]) du premier nœud de la partie finale — table des
  // matières, index, glossaire. Tout ce qui suit (lui compris) part en `final`,
  // titres compris : ces titres-là ne sont pas de la structure du livre.
  // `undefined` = pas de partie finale, le corps va jusqu'au bout.
  structureEndIndex?: number
  // Niveau corrigé pour un titre mal détecté, par index de FlatNode.
  // 0 = "ignorer" (rétrograder en simple paragraphe).
  levelOverrides?: Record<number, number>
}
