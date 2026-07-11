import { HarmonizedItem } from '../import/odt-parser'

const HTML_TAG_RE = /<[^>]*>/g

// Balises <a class="lien-interne">, <strong>… retirées avant toute analyse —
// remplacées par un espace (pas une chaîne vide) pour ne pas coller deux mots.
export function stripHtmlTags(text: string): string {
  return text.replace(HTML_TAG_RE, ' ')
}

// Texte brut d'un nœud pour l'analyse : paragraphes séparés par une ligne
// vide (frontière de phrase fiable pour spaCy), items de liste par un retour.
export function plainNodeText(entries: HarmonizedItem['texte']): string {
  return entries
    .map((entry) =>
      entry.type === 'list' ? entry.items.map((item) => item.text).join('\n') : entry.text,
    )
    .map(stripHtmlTags)
    .join('\n\n')
}
