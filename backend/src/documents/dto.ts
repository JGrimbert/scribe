import { DataMap, ImportCorrections, OutlineEntry, StyleInventory, Trame } from '../import/odt-parser'
import { DocumentTypology, StyleRole } from './typology'

export interface PreviewResponse {
  previewId: string
  outline: OutlineEntry[]
  suggestedStructureStartIndex: number
  // Absent = aucune suggestion de partie finale. C'est un résultat à part
  // entière, pas une erreur : l'écran de calibration n'affiche alors pas de
  // seconde démarcation tant que l'utilisateur ne la pose pas lui-même.
  suggestedStructureEndIndex?: number
}

export type CommitImportRequest = ImportCorrections

export interface DocumentSummary {
  id: string
  title: string
  sourceFilename: string
  importedAt: string
  totalAxes: number
  totalBlocs: number
  totalArticles: number
  totalMots: number
  totalCaracteres: number
}

/**
 * Sous-ensemble de Trame réellement consommé par FolioComposer (sections
 * computed, cf. FolioComposer.vue) : meta/liminaire/final ne sont pas utilisés
 * côté frontend, inutile de les reconstruire depuis la DB.
 */
export interface DocumentContent {
  title: string
  trame: { axes: Trame['axes'] }
  data: DataMap
  // État de validation résolu, par nœud — seuls les nœuds validés y figurent.
  // Résolu ici et pas côté client : départager « validé » de « périmé »
  // suppose de rehacher le texte courant par le même chemin exactement
  // (plainNodeText + sha256) — dupliquer ce calcul en JS, c'est signer pour
  // deux implémentations qui divergeront.
  validations: Record<string, NodeValidationState>
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
}
