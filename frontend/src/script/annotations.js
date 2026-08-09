// Passages ANNOTÉS : ce que l'auteur a surligné dans son .odt. Deux marques (parseur
// ODT) : `entry.highlight` (paragraphe entier) et `<mark data-hl="#rrggbb">` (portion).
// Seules comptent les couleurs typées `annotation` (les autres sont de l'emphase). Les
// listes sont ignorées (un item n'a pas de phrase à montrer).

const stripTags = (s) => s.replace(/<[^>]+>/g, '')

// Le texte porte les entités du .odt : `fragmentEntries` les ré-échappe pour l'iframe.
const unescapeHtml = (s) => s
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')

const clean = (s) => unescapeHtml(stripTags(s)).replace(/\s+/g, ' ').trim()

// Borne d'un lambeau confortable (plus long, il chasse les suivants hors de la page).
const MAX_CHARS = 240

function clamp(phrase) {
  if (phrase.length <= MAX_CHARS) return phrase
  const cut = phrase.slice(0, MAX_CHARS)
  const at = cut.lastIndexOf(' ')
  return `${at > MAX_CHARS / 2 ? cut.slice(0, at) : cut}…`
}

// Couleurs typées « annotation », normalisées (le .odt écrit `#FFFF00` ou `#ffff00`).
export function annotationColors(highlights) {
  return new Set(
    Object.entries(highlights ?? {})
      .filter(([, role]) => role === 'annotation')
      .map(([color]) => color.toLowerCase()),
  )
}

const MARK_RE = /<mark data-hl="([^"]*)"[^>]*>([\s\S]*?)<\/mark>/g

function inlineMarks(text, colors) {
  const out = []
  for (const [, color, inner] of text.matchAll(MARK_RE)) {
    if (!colors.has(color.toLowerCase())) continue
    const phrase = clean(inner)
    if (phrase) out.push({ phrase, color: color.toLowerCase() })
  }
  return out
}

// Un passage par marque, dans l'ordre de lecture. `nodes` = bookNodes (même forme que
// les hits de recherche, pour se couler dans le même fragmentPages).
export function annotatedPassages(nodes, data, highlights) {
  const colors = annotationColors(highlights)
  if (!colors.size || !data) return []
  const out = []
  for (const node of nodes) {
    for (const entry of data[node.id]?.texte ?? []) {
      if (entry?.type !== 'paragraph' || !entry.text) continue
      // Le paragraphe entier d'abord (marque la plus large), puis ses marques inline.
      const whole = entry.highlight?.toLowerCase()
      if (whole && colors.has(whole)) {
        const phrase = clean(entry.text)
        if (phrase) out.push({ ...node, phrase: clamp(phrase), color: whole })
      }
      for (const mark of inlineMarks(entry.text, colors)) {
        out.push({ ...node, phrase: clamp(mark.phrase), color: mark.color })
      }
    }
  }
  return out
}

// Longueur du texte propre d'un nœud en CARACTÈRES : l'unité de la règle `minChars`
// (rien à voir avec le compte de MOTS du backend).
export function nodeCharCounts(nodes, data) {
  return nodes.map((node) => {
    const chars = (data?.[node.id]?.texte ?? []).reduce((sum, entry) => (
      entry?.type === 'paragraph' && entry.text ? sum + clean(entry.text).length : sum
    ), 0)
    return { ...node, chars }
  })
}
