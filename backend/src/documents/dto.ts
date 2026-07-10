import { DataMap, Trame } from '../import/odt-parser'

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
  trame: { axes: Trame['axes'] }
  data: DataMap
}
