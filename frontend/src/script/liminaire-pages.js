import { typeOfStyleName, sideOfPageStart } from './liminaire-vocab'

function stripTags(html) {
  return (html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// Texte brut d'une entrée liminaire (paragraphe ou liste).
export function entryPlainText(entry) {
  if (!entry) return ''
  if (entry.type === 'list') return (entry.items ?? []).map((i) => stripTags(i.text)).join(' ').trim()
  return stripTags(entry.text)
}

// Hash djb2 stable (sans crypto).
function hashText(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Clé stable d'une entrée : hash du texte + rang d'occurrence (deux textes identiques,
// ou toutes les pages blanches, ne partagent pas la même clé). Stable sous fusion/
// scission : c'est ce qui laisse la config, keyée par entrée, survivre à un reparse.
export function withEntryKeys(entries) {
  const seen = new Map()
  return (entries ?? []).map((entry) => {
    const text = entryPlainText(entry)
    const occ = seen.get(text) ?? 0
    seen.set(text, occ + 1)
    return { ...entry, key: `le_${hashText(`${text}#${occ}`)}`, isBlank: text === '' }
  })
}

// Regroupe les entrées en PAGES. Une entrée ouvre une page si : c'est la première ; ou
// la config force `break: 'start'` ; ou elle porte un `pageStart` du .odt (sauf
// `'joined'`) ; ou son NOM DE STYLE désigne un type liminaire différent de celui qui
// ancre la page en cours (les deux types non nuls — un style anonyme ne scinde rien) ;
// ou son STYLE est réglé pour ouvrir une page (precedesOf ≠ 'none'). Une fusion manuelle
// (`joined`) désarme les deux derniers déclencheurs.
export function groupLiminairePages(entries, config = {}, precedesOf = () => 'none') {
  const keyed = withEntryKeys(entries)
  const pages = []
  let anchorType = null
  keyed.forEach((entry, i) => {
    const brk = config?.[entry.key]?.break
    const styleType = typeOfStyleName(entry.styleName)
    const styleSplit = brk !== 'joined' && styleType != null && anchorType != null && styleType !== anchorType
    const styleStarts = brk !== 'joined' && precedesOf(entry.styleName) !== 'none'
    const starts = i === 0 || brk === 'start' || (brk !== 'joined' && entry.pageStart != null) || styleSplit || styleStarts
    if (starts || !pages.length) {
      pages.push({
        ordinal: pages.length,
        key: entry.key,
        sideFromOdt: sideOfPageStart(entry.pageStart),
        precedes: precedesOf(entry.styleName),
        entries: [],
      })
      anchorType = null
    }
    pages[pages.length - 1].entries.push(entry)
    if (anchorType == null && styleType != null) anchorType = styleType
  })
  for (const page of pages) {
    const content = page.entries.filter((e) => !e.isBlank)
    page.isBlank = content.length === 0
    page.preview = content.map(entryPlainText).find((t) => t) ?? ''
  }
  return pages
}
