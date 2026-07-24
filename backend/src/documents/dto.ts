import { DataMap, ImportCorrections, OutlineEntry, PageFormat, StyleInventory, StyleVisual, Trame } from '../import/odt-parser'
import { DeclaredStyle, DocumentTypology, StyleRole } from './typology'
import { StyleDefaults } from './style-defaults'
import { StyleOverrides } from './style-overrides'

export interface PreviewResponse {
  previewId: string
  outline: OutlineEntry[]
  suggestedStructureStartIndex: number
  // Absent = aucune suggestion de partie finale. C'est un résultat à part
  // entière, pas une erreur : l'écran de calibration n'affiche alors pas de
  // seconde démarcation tant que l'utilisateur ne la pose pas lui-même.
  suggestedStructureEndIndex?: number
  // Les bornes RÉELLEMENT validées au dernier commit, à ne pas confondre avec
  // les suggestions ci-dessus : c'est là que la calibration doit rouvrir. Null
  // pour un import neuf (rien n'a encore été validé) et pour les documents
  // antérieurs à ces colonnes.
  currentStructureStartIndex: number | null
  currentStructureEndIndex: number | null
}

export type CommitImportRequest = ImportCorrections

// Ce qu'une recalibration a fait des validations manuelles existantes. Une
// relecture perdue doit se dire : recalibrer peut légitimement faire
// disparaître un chapitre (une borne qui le renvoie au liminaire), et
// l'utilisateur est le seul à pouvoir juger si c'est ce qu'il voulait.
export interface RecalibrationReport {
  restoredValidations: number
  droppedValidations: { slug: string; reason: 'disparu' | 'ambigu' }[]
  // Nœuds dont l'id a été conservé — c'est ce qui permet aux analyses de
  // survivre au recalibrage (cf. remapNodeIds).
  reusedNodes: number
  // Nœuds qu'on n'a pas su retrouver : les analyses déjà calculées ne les
  // désignent plus. Comptés et affichés, jamais devinés.
  orphanedNodes: number
  // Faux seulement quand plus RIEN ne s'apparie : les analyses sont alors
  // supprimées, le document ayant trop changé pour qu'elles parlent de lui.
  analysesKept: boolean
}

// `recalibration` est absent d'un import initial : il n'y a alors aucune
// validation à réapparier, et un rapport de zéro sur zéro ne dirait rien.
export type CommitResponse = DocumentSummary & { recalibration?: RecalibrationReport }

export interface DocumentSummary {
  id: string
  title: string
  // Le NOM du fichier importé, toujours présent (colonne de Document). Ne dit
  // RIEN sur la conservation du fichier lui-même : voir `hasSource`.
  sourceFilename: string
  importedAt: string
  totalAxes: number
  totalBlocs: number
  totalArticles: number
  totalMots: number
  totalCaracteres: number
  // Le .odt d'origine est-il conservé (cf. DocumentSource) ? Faux pour les
  // documents importés avant cette table : ni recalibrables, ni ré-enrichissables
  // par un parseur amélioré — seul un réimport les rattache. Exposé parce que
  // sans lui le frontend ne peut que PROPOSER une recalibration puis afficher
  // l'échec ; un bouton qu'on sait voué à échouer ne doit pas être actif.
  hasSource: boolean
  // Taille du .odt conservé, `null` s'il n'y en a pas. Lu depuis la colonne
  // `sizeBytes` de DocumentSource — la demander ne charge pas le blob, c'est
  // tout l'intérêt de la table à part.
  sourceSizeBytes: number | null
}

/**
 * Sous-ensemble de Trame reconstruit depuis la DB : `axes` pour FolioComposer,
 * `liminaire`/`final` pour le composer de pages liminaires de la config
 * (LiminaireComposer). `meta` reste inutile côté frontend.
 */
export interface DocumentContent {
  title: string
  trame: { axes: Trame['axes']; liminaire: Trame['liminaire']; final: Trame['final'] }
  data: DataMap
  // État de validation résolu, par nœud — seuls les nœuds validés y figurent.
  // Résolu ici et pas côté client : départager « validé » de « périmé »
  // suppose de rehacher le texte courant par le même chemin exactement
  // (plainNodeText + sha256) — dupliquer ce calcul en JS, c'est signer pour
  // deux implémentations qui divergeront.
  validations: Record<string, NodeValidationState>
  // Apparence des styles (par nom de style EFFECTIF, même clé que
  // `TexteEntry.styleName`) et format de page, lus du `styleInventory` : la
  // couche Folio les applique pour un rendu FIDÈLE au .odt (police, corps,
  // alignement…). Vides pour un document importé avant la lecture de styles.xml.
  visuals: Record<string, StyleVisual>
  page: PageFormat | null
  // Réglages typographiques généraux (décision utilisateur, cf. style-defaults.ts) :
  // la couche Folio applique la césure au-dessus des styles du .odt. Toujours
  // normalisé (jamais null) — un document sans réglage rend les défauts.
  hyphenation: StyleDefaults['hyphenation']
}

// L'éditeur de styles (panneau de config) a besoin des deux : la valeur .odt
// d'origine (`base`, placeholder / point de retour) et la surcharge Scribe
// courante (`overrides`, éditable). Le rendu, lui, ne reçoit que le merge des deux
// (cf. DocumentContent.visuals) — pas cette forme.
export interface StyleOverridesResponse {
  overrides: StyleOverrides
  base: Record<string, StyleVisual>
}

export type NodeValidationState = 'validé' | 'périmé'

export interface NodeValidationResponse {
  nodeId: string
  state: NodeValidationState
  validatedAt: string
}

// Tout ce dont l'écran de typologie a besoin en un appel : ce qu'il y a dans
// le document (inventory), ce qui a été décidé (typology, null si rien), et ce
// qu'on propose à défaut (suggested). `settled` réconcilie les deux — un style
// apparu depuis la dernière décision suffit à repasser à false.
export interface TypologyResponse {
  inventory: StyleInventory
  typology: DocumentTypology | null
  suggested: DocumentTypology
  settled: boolean
}

export interface SaveTypologyRequest {
  styles: Record<string, StyleRole>
  highlights: Record<string, string>
  // Styles ajoutés à la main (hors inventaire), avec leur place. Cf. typology.ts.
  declaredStyles?: DeclaredStyle[]
}
