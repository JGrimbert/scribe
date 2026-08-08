// Passages ANNOTÉS du livre : ce que l'auteur a surligné dans son `.odt` pour se
// laisser un mot (« passage à reprendre »). Deux marques distinctes, posées par
// le parseur ODT (cf. backend/src/import/odt-parser) :
//  · `entry.highlight` — le surlignage coiffe le PARAGRAPHE entier ;
//  · `<mark data-hl="#rrggbb">…</mark>` — il ne porte que sur une portion.
// Seules comptent les couleurs que la typologie range en `annotation` : les
// autres sont de l'emphase (ou rien), et les faire remonter ici noierait les
// annotations sous du gras jaune.
//
// Les listes sont laissées de côté : le surlignage d'annotation vit dans le
// corps du texte, et un item de liste n'a pas de phrase à montrer.

const stripTags = (s) => s.replace(/<[^>]+>/g, '')

// Le texte porte les entités du .odt (`&amp;`, `&lt;`) : le lambeau les rend en
// clair, et `fragmentEntries` les ré-échappe pour l'iframe.
const unescapeHtml = (s) => s
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')

const clean = (s) => unescapeHtml(stripTags(s)).replace(/\s+/g, ' ').trim()

// Un surlignage de paragraphe peut couvrir un pavé entier : on en montre le
// début, coupé sur un mot. La borne est celle d'un lambeau confortable — plus
// long, il chasse les suivants hors de la page.
const MAX_CHARS = 240

function clamp(phrase) {
  if (phrase.length <= MAX_CHARS) return phrase
  const cut = phrase.slice(0, MAX_CHARS)
  const at = cut.lastIndexOf(' ')
  return `${at > MAX_CHARS / 2 ? cut.slice(0, at) : cut}…`
}

// Les couleurs typées « annotation », normalisées : le .odt écrit `#FFFF00`
// autant que `#ffff00`, et la map de typologie garde la casse du relevé.
export function annotationColors(highlights) {
  return new Set(
    Object.entries(highlights ?? {})
      .filter(([, role]) => role === 'annotation')
      .map(([color]) => color.toLowerCase()),
  )
}

const MARK_RE = /<mark data-hl="([^"]*)"[^>]*>([\s\S]*?)<\/mark>/g

// Les portions marquées d'un paragraphe, couleur par couleur.
function inlineMarks(text, colors) {
  const out = []
  for (const [, color, inner] of text.matchAll(MARK_RE)) {
    if (!colors.has(color.toLowerCase())) continue
    const phrase = clean(inner)
    if (phrase) out.push({ phrase, color: color.toLowerCase() })
  }
  return out
}

// Un passage par marque, dans l'ordre de lecture. `nodes` vient de
// `bookNodes` (id · titre · fil d'Ariane) — même forme que les hits de recherche,
// pour que les lambeaux se coulent dans le même `fragmentPages`.
export function annotatedPassages(nodes, data, highlights) {
  const colors = annotationColors(highlights)
  if (!colors.size || !data) return []
  const out = []
  for (const node of nodes) {
    for (const entry of data[node.id]?.texte ?? []) {
      if (entry?.type !== 'paragraph' || !entry.text) continue
      // Le paragraphe entier d'abord : c'est la marque la plus large, elle
      // ouvre le passage. Ses marques inline suivent, s'il en porte d'autres.
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

// Longueur du texte propre d'un nœud, en CARACTÈRES : c'est l'unité de la règle
// `minChars`, et donc la seule qui permette de dire quels chapitres elle
// disqualifie. Rien à voir avec le compte de MOTS du backend (seuil des
// « chapitres en attente »), qui répond à une autre question.
export function nodeCharCounts(nodes, data) {
  return nodes.map((node) => {
    const chars = (data?.[node.id]?.texte ?? []).reduce((sum, entry) => (
      entry?.type === 'paragraph' && entry.text ? sum + clean(entry.text).length : sum
    ), 0)
    return { ...node, chars }
  })
}
