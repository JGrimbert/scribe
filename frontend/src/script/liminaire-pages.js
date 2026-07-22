import { typeOfStyleName, sideOfPageStart } from './liminaire-vocab'

// Retire les marqueurs (<mark>, <a data-bookmark>…) pour un aperçu / une clé
// lisibles : le texte d'une entrée porte des balises, pas seulement des mots.
function stripTags(html) {
  return (html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// Texte brut d'une entrée liminaire (paragraphe ou liste).
export function entryPlainText(entry) {
  if (!entry) return ''
  if (entry.type === 'list') return (entry.items ?? []).map((i) => stripTags(i.text)).join(' ').trim()
  return stripTags(entry.text)
}

// Hash djb2 stable (sans dépendance crypto) — assez pour distinguer une poignée
// d'entrées liminaires.
function hashText(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Clé STABLE d'une entrée : hash de son texte + son rang d'occurrence. Deux
// « JŌHĀNĀN & MARVĀRĪD » (faux-titre puis page de titre) ne doivent pas partager
// la même clé ; les pages blanches, toutes vides, non plus. Stable sous
// fusion/scission (les entrées ne bougent pas, seul leur regroupement change) —
// c'est ce qui laisse la config, keyée par entrée, survivre à un changement de
// frontières comme à un reparse.
export function withEntryKeys(entries) {
  const seen = new Map()
  return (entries ?? []).map((entry) => {
    const text = entryPlainText(entry)
    const occ = seen.get(text) ?? 0
    seen.set(text, occ + 1)
    return { ...entry, key: `le_${hashText(`${text}#${occ}`)}`, isBlank: text === '' }
  })
}

// Regroupe les entrées en PAGES. Une entrée ouvre une page si :
//  - c'est la première ; ou
//  - la config force `break: 'start'` (scission manuelle) ; ou
//  - elle porte un `pageStart` du .odt ET la config ne force pas `'joined'`
//    (fusion manuelle avec la page précédente) ; ou
//  - son NOM DE STYLE désigne un type liminaire DIFFÉRENT de celui qui ancre la
//    page en cours (mentions légales → Dédicace) : le .odt ne met pas toujours
//    un saut entre deux pages liminaires, mais deux types ne partagent jamais
//    une page. On exige les DEUX types non nuls — un style anonyme (ornement,
//    ligne vide) ne scinde rien, sans quoi la page de titre exploserait.
// Le côté RÉEL (`sideFromOdt`) et le tag (type/côté) sont ancrés sur la PREMIÈRE
// entrée de la page (`key`). Une page dont toutes les entrées sont vides est une
// page blanche (`isBlank`), non taggable.
export function groupLiminairePages(entries, config = {}) {
  const keyed = withEntryKeys(entries)
  const pages = []
  // Type de style qui ANCRE la page en cours (le premier rencontré) : c'est lui
  // qu'un style de type différent vient contredire.
  let anchorType = null
  keyed.forEach((entry, i) => {
    const brk = config?.[entry.key]?.break
    const styleType = typeOfStyleName(entry.styleName)
    const styleSplit = brk !== 'joined' && styleType != null && anchorType != null && styleType !== anchorType
    const starts = i === 0 || brk === 'start' || (brk !== 'joined' && entry.pageStart != null) || styleSplit
    if (starts || !pages.length) {
      pages.push({ ordinal: pages.length, key: entry.key, sideFromOdt: sideOfPageStart(entry.pageStart), entries: [] })
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
