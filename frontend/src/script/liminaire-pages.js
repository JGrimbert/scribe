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

// Regroupe les entrées en PAGES. La DISPOSITION de chaque élément
// (`config[clé].disposition`) prime, sinon le .odt décide :
//  - 'none'  (continu)      : l'élément RECOLLE à la page en cours (désarme tout saut) ;
//  - 'break' (saut de page) : l'élément OUVRE un nouveau folio ;
//  - 'blank' (belle page)   : idem + une blanche avant (page.precedes = 'blank') ;
//  - absent (défaut)        : l'élément suit le .odt — ouvre une page s'il porte un
//    `pageStart`, ou si son NOM DE STYLE désigne un type liminaire différent de celui qui
//    ancre la page en cours (un style anonyme ne scinde rien).
export function groupLiminairePages(entries, config = {}) {
  const keyed = withEntryKeys(entries)
  const pages = []
  let anchorType = null
  keyed.forEach((entry, i) => {
    const disp = config?.[entry.key]?.disposition
    const forceJoin = disp === 'none'
    const forceOpen = disp === 'break' || disp === 'blank'
    const styleType = typeOfStyleName(entry.styleName)
    const styleSplit = !forceJoin && styleType != null && anchorType != null && styleType !== anchorType
    const starts = i === 0 || forceOpen || (!forceJoin && entry.pageStart != null) || styleSplit
    if (starts || !pages.length) {
      pages.push({
        ordinal: pages.length,
        key: entry.key,
        sideFromOdt: sideOfPageStart(entry.pageStart),
        precedes: disp === 'blank' ? 'blank' : 'none',
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
