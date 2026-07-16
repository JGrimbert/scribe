import { createHash } from 'crypto'
import { HarmonizedItem } from '../import/odt-parser'
// Une seule définition de « retirer les balises » : le parseur en a besoin
// pour ses stats, l'analyse pour le NLP. Deux copies, c'est deux règles qui
// divergent — et des comptes de mots qui ne se recoupent plus.
import { stripHtmlTags } from '../import/odt-parser/text-utils'

export { stripHtmlTags }

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

// Empreinte du contenu d'un nœud — sert à périmer une validation manuelle
// quand le texte a changé depuis la relecture (cf. NodeValidation dans
// schema.prisma). Assis sur le texte BRUT, espaces normalisés : ce qui périme
// une relecture, c'est que les MOTS aient changé.
//
// L'espacement doit être écrasé, pas seulement ignoré à la marge :
// stripHtmlTags remplace chaque balise par une espace, donc passer un mot en
// gras injecte deux espaces au milieu du texte. Sans ce collapse, un simple
// changement de mise en forme périmerait la relecture — exactement ce qu'on
// veut éviter. Effet de bord assumé : couper un paragraphe en deux sans
// toucher aux mots ne périme rien non plus (la prose est la même).
export function nodeContentHash(entries: HarmonizedItem['texte']): string {
  const normalized = plainNodeText(entries).replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(normalized).digest('hex')
}
