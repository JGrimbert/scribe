import { DataMap, HarmonizedItem } from '../import/odt-parser'
import { plainParagraphTexts } from './plain-text'

// Un segment de corpus pour l'extraction de thèmes : ~200-400 mots de
// paragraphes consécutifs d'un même nœud (jamais à cheval sur deux nœuds —
// une frontière d'article est une vraie frontière éditoriale). L'id encode
// le nodeId pour que l'agrégation par nœud/axe se fasse sans table de
// correspondance à conserver entre le lancement du job et son polling.
export interface CorpusSegment {
  id: string
  nodeId: string
  text: string
  words: number
}

const TARGET_WORDS = 250
const MAX_WORDS = 400

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function segmentNode(item: HarmonizedItem): CorpusSegment[] {
  const segments: CorpusSegment[] = []
  let buffer: string[] = []
  let words = 0

  const flush = () => {
    if (!words) return
    segments.push({
      id: `${item.id}::${segments.length}`,
      nodeId: item.id,
      text: buffer.join('\n\n'),
      words,
    })
    buffer = []
    words = 0
  }

  for (const text of plainParagraphTexts(item.texte)) {
    const paragraphWords = countWords(text)
    if (words > 0 && words + paragraphWords > MAX_WORDS) flush()
    buffer.push(text)
    words += paragraphWords
    if (words >= TARGET_WORDS) flush()
  }
  flush()

  return segments
}

export function buildSegments(data: DataMap): CorpusSegment[] {
  return Object.values(data).flatMap(segmentNode)
}
