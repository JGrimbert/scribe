import { HarmonizedItem } from '../import/odt-parser'

const HTML_TAG_RE = /<[^>]*>/g

// Balises <a class="lien-interne">, <strong>… retirées avant toute analyse —
// remplacées par un espace (pas une chaîne vide) pour ne pas coller deux mots.
export function stripHtmlTags(text: string): string {
  return text.replace(HTML_TAG_RE, ' ')
}

// Texte brut de chaque paragraphe d'un nœud (une entrée = un paragraphe,
// items de liste joints par un retour) — les entrées vides sont écartées.
// C'est l'unité d'embedding : sentence-camembert tronque au-delà de
// ~128 tokens, un article entier serait amputé.
export function plainParagraphTexts(entries: HarmonizedItem['texte']): string[] {
  return entries
    .map((entry) =>
      entry.type === 'list' ? entry.items.map((item) => item.text).join('\n') : entry.text,
    )
    .map((text) => stripHtmlTags(text).trim())
    .filter((text) => text.length > 0)
}

// Texte brut d'un nœud entier : paragraphes séparés par une ligne vide
// (frontière de phrase fiable pour spaCy).
export function plainNodeText(entries: HarmonizedItem['texte']): string {
  return plainParagraphTexts(entries).join('\n\n')
}
