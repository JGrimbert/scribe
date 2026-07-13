import { DataMap, ImportCorrections, OutlineEntry, Trame } from '../import/odt-parser'

export interface PreviewResponse {
  previewId: string
  outline: OutlineEntry[]
  suggestedStructureStartIndex: number
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
 * computed, cf. FolioComposer.vue) : meta/preambule ne sont pas utilisés
 * côté frontend, inutile de les reconstruire depuis la DB.
 */
export interface DocumentContent {
  title: string
  trame: { axes: Trame['axes'] }
  data: DataMap
}
