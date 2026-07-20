// Les pages liminaires conventionnelles, dans l'ordre de lecture. Vocabulaire
// FERMÉ (comme STYLE_ROLES) : les règles de composition les visent, une
// étiquette libre serait une faute de frappe qui casse une vérification en
// silence. Glossaire / index viendront côté partie finale, pas ici.
//
// - `obligatoire` : indécochable dans la checklist (faux-titre, page de titre,
//   mentions légales — le minimum d'un livre).
// - `side` : le côté ATTENDU par la convention (recto = page impaire, verso =
//   paire), ou null quand la convention n'impose rien. Distinct du côté RÉEL
//   lu du .odt (pageStart) et du côté CHOISI par l'utilisateur (config).
// - `position` : avant ou après le récit.
export const LIMINAIRE_PAGES = [
  { key: 'faux-titre', label: 'Faux-titre', obligatoire: true, side: 'recto', position: 'avant' },
  { key: 'du-meme-auteur', label: 'Du même auteur', obligatoire: false, side: 'recto', position: 'avant' },
  { key: 'page-de-titre', label: 'Page de titre', obligatoire: true, side: 'recto', position: 'avant' },
  { key: 'mentions-legales', label: 'Mentions légales', obligatoire: true, side: 'verso', position: 'avant' },
  { key: 'a-propos-auteur', label: "À propos de l'auteur", obligatoire: false, side: null, position: 'avant' },
  // Dédicace et épigraphe vont sur une belle page (recto), verso blanc avant :
  // ce sont des ANCRES de parité, pas des pages libres — sans côté imposé elles
  // dérivent et décalent toute la suite du liminaire.
  { key: 'epigraphe', label: 'Épigraphe', obligatoire: false, side: 'recto', position: 'avant' },
  { key: 'dedicace', label: 'Dédicace', obligatoire: false, side: 'recto', position: 'avant' },
  { key: 'table-des-matieres', label: 'Table des matières', obligatoire: false, side: null, position: 'avant' },
  { key: 'preface', label: 'Préface', obligatoire: false, side: null, position: 'avant' },
  { key: 'avant-propos', label: 'Avant-propos', obligatoire: false, side: null, position: 'avant' },
  { key: 'avertissement', label: 'Avertissement', obligatoire: false, side: null, position: 'avant' },
  { key: 'remerciements', label: 'Remerciements', obligatoire: false, side: null, position: 'avant' },
  { key: 'personnages', label: 'Principaux personnages', obligatoire: false, side: null, position: 'avant' },
  { key: 'postface', label: 'Postface', obligatoire: false, side: null, position: 'apres' },
  { key: 'colophon', label: 'Colophon', obligatoire: false, side: null, position: 'apres' },
  { key: 'imprimeur', label: "Achevé d'imprimer", obligatoire: false, side: 'verso', position: 'apres' },
]

export const LIMINAIRE_BY_KEY = new Map(LIMINAIRE_PAGES.map((p) => [p.key, p]))

// Nom de style → type liminaire, quand l'auteur a NOMMÉ son style (« mentions
// légales », « Dédicace », « Citation liminaire »…). C'est le signal le plus
// fiable du document, et il sert deux fois : à suggérer un type
// (liminaire-suggest) ET à poser une frontière de page (groupLiminairePages) —
// deux styles de types différents ne peuvent pas cohabiter sur une page.
// Vit ici, avec le vocabulaire, pour que les deux usages ne divergent pas.
// « mentions LÉGALES » exige « légal » : un style « mention sous titre » (le
// sous-titre de la page de titre) est un sous-titre, pas un copyright.
const STYLE_TYPE_PATTERNS = [
  [/mentions?\s+l[eé]gal/, 'mentions-legales'],
  [/d[eé]dicace/, 'dedicace'],
  [/[eé]pigraphe|citation/, 'epigraphe'],
  [/faux[-\s]?titre/, 'faux-titre'],
  [/du m[eê]me auteur/, 'du-meme-auteur'],
  [/table des mati|sommaire/, 'table-des-matieres'],
  [/avant[-\s]propos/, 'avant-propos'],
  [/pr[eé]face/, 'preface'],
  [/postface/, 'postface'],
  [/remerciement/, 'remerciements'],
  [/avertissement/, 'avertissement'],
  [/colophon|achev[eé] d.?imprimer/, 'imprimeur'],
]

export function typeOfStyleName(styleName) {
  const s = (styleName || '').toLowerCase()
  if (!s) return null
  for (const [re, key] of STYLE_TYPE_PATTERNS) if (re.test(s)) return key
  return null
}

// Côtés qu'une page peut imposer. 'auto' = pas de contrainte (le composer
// laisse la parité couler). Séparé du pageStart brut du .odt, qui peut valoir
// 'page' (simple saut, sans côté) → côté 'auto'.
export const PAGE_SIDES = ['auto', 'recto', 'verso']

// Le côté imposé par un pageStart lu du .odt : recto/verso le portent, un simple
// saut ('page') ou rien n'imposent aucun côté.
export function sideOfPageStart(pageStart) {
  return pageStart === 'recto' || pageStart === 'verso' ? pageStart : 'auto'
}

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

// Le côté EFFECTIF d'une page pour la composition, par ordre d'autorité :
//  1. `side` CHOISI par l'utilisateur (config.side) — il tranche ;
//  2. `sideFromOdt` — le côté RÉEL lu du .odt (ground truth de CE document) ;
//  3. `typeSide` — la CONVENTION du type tagué (faux-titre=recto, mentions=verso…),
//     l'ancre de parité : sans elle, taguer une page ne la place nulle part et le
//     liminaire dérive. Le composer la fournit depuis LIMINAIRE_PAGES[].side.
// 'auto' = libre (la parité coule).
export function effectiveSide(page) {
  if (page?.side && page.side !== 'auto') return page.side
  if (page?.sideFromOdt && page.sideFromOdt !== 'auto') return page.sideFromOdt
  return page?.typeSide && page.typeSide !== 'auto' ? page.typeSide : 'auto'
}

// Numérotation PHYSIQUE des pages, façon imposition : chaque page occupe un
// folio ; une page contrainte à un côté (recto = impair / verso = pair) qui
// tomberait du mauvais côté fait insérer une page blanche IMPLICITE avant elle
// pour rétablir la parité — sauf si la précédente est déjà blanche (règle
// « deux sauts consécutifs → une seule blanche »). Les pages doivent porter un
// `side` effectif (cf. effectiveSide).
export function computeImposition(pages) {
  const slots = []
  let n = 1
  let started = false
  const parity = (num) => (num % 2 === 1 ? 'recto' : 'verso')
  for (const page of pages ?? []) {
    if (page.isBlank) {
      // Blanche AVANT le premier contenu = intérieur de couverture (non
      // numérotée) : sans quoi elle prendrait la page 1 et pousserait le
      // faux-titre en verso, alors qu'il doit être recto.
      if (!started) {
        slots.push({ number: 0, parity: 'verso', blank: true, cover: true, page })
        continue
      }
      slots.push({ number: n, parity: parity(n), blank: true, page })
      n++
      continue
    }
    started = true
    const want = effectiveSide(page)
    if (want !== 'auto' && parity(n) !== want) {
      const prev = slots[slots.length - 1]
      if (prev && prev.blank && !prev.cover) {
        // Une blanche précède ET la parité est fausse : elle est mal placée. On
        // l'ABSORBE (au lieu d'en ajouter une seconde, ce qui ferait deux
        // blanches d'affilée) — la page reprend son numéro et retombe sur son
        // côté conventionnel. C'est « la convention l'emporte sur les blanches
        // du .odt » : Writer pose des blanches sans connaître nos types.
        slots.pop()
        n--
      } else {
        slots.push({ number: n, parity: parity(n), blank: true, implicit: true })
        n++
      }
    }
    slots.push({ number: n, parity: parity(n), blank: false, page })
    n++
  }
  return slots
}

// Regroupe les folios en PLANCHES telles qu'on les voit dans un livre ouvert :
// la page 1 (recto) est seule à droite, face à l'intérieur de couverture (la
// dernière blanche de tête, si présente) ; ensuite des paires (verso pair à
// gauche | recto impair à droite).
export function toSpreads(slots) {
  const byNum = new Map(slots.filter((s) => !s.cover).map((s) => [s.number, s]))
  const covers = slots.filter((s) => s.cover)
  const cover = covers.length ? covers[covers.length - 1] : null
  const max = byNum.size ? Math.max(...byNum.keys()) : 0
  const spreads = []
  if (max >= 1 || cover) spreads.push({ left: cover, right: byNum.get(1) ?? null })
  for (let e = 2; e <= max; e += 2) spreads.push({ left: byNum.get(e) ?? null, right: byNum.get(e + 1) ?? null })
  return spreads
}

// L'éligibilité du liminaire, dérivée du tagging (pas une saisie à part) —
//  - `obligatoires` : les trois pages minimales, avec leur présence.
//  - `presentTypes` : tous les types assignés (pour cocher les optionnels).
//  - `conflicts` : une page dont le côté CHOISI contredit le côté conventionnel
//    de son type (mentions légales en recto, p. ex.). 'auto' ne contredit rien.
//  - `duplicates` : un type conventionnel assigné à plusieurs pages (une page de
//    titre en double n'est pas une page de titre plus sûre).
// Les pages blanches sont hors jeu (elles ne portent pas de type).
export function deriveEligibility(pages, config) {
  const assigned = (pages ?? []).filter((p) => !p.isBlank).map((page) => ({
    page,
    type: config?.[page.key]?.type ?? null,
    side: config?.[page.key]?.side ?? 'auto',
  }))
  const presentTypes = new Set(assigned.map((a) => a.type).filter(Boolean))

  const byType = new Map()
  for (const a of assigned) {
    if (!a.type) continue
    byType.set(a.type, (byType.get(a.type) ?? 0) + 1)
  }

  const obligatoires = LIMINAIRE_PAGES.filter((t) => t.obligatoire).map((t) => ({
    key: t.key,
    label: t.label,
    present: presentTypes.has(t.key),
  }))

  const conflicts = []
  for (const a of assigned) {
    const def = a.type && LIMINAIRE_BY_KEY.get(a.type)
    if (def && def.side && a.side !== 'auto' && a.side !== def.side) {
      conflicts.push({ key: a.page.key, type: a.type, label: def.label, chosen: a.side, expected: def.side })
    }
  }

  const duplicates = [...byType.entries()]
    .filter(([, n]) => n > 1)
    .map(([type, n]) => ({ type, label: LIMINAIRE_BY_KEY.get(type)?.label ?? type, count: n }))

  return { assigned, presentTypes, obligatoires, conflicts, duplicates }
}

// ─── Accès à la config de tagging ────────────────────────────────────────────
// La config est keyée par ENTRÉE et MUTÉE EN PLACE par les composants (même
// convention que RuleSetForm). Ces helpers vivent ici, et non dans un
// composant, parce que le composer, l'accordéon et le découpage lisent tous les
// trois le même objet : trois copies des mêmes accès divergeraient.

export function typeOfPage(config, page) {
  return config?.[page?.key]?.type ?? ''
}

export function sideOfPage(config, page) {
  return config?.[page?.key]?.side ?? 'auto'
}

export function breakOfKey(config, key) {
  return config?.[key]?.break
}

function entryFor(config, key) {
  return (config[key] ??= {})
}

export function setPageType(config, page, value) {
  entryFor(config, page.key).type = value || undefined
}

export function setPageSide(config, page, value) {
  entryFor(config, page.key).side = value === 'auto' ? undefined : value
}

// Toggle : re-cliquer une frontière posée la retire (retour au signal du .odt).
// On nettoie l'entrée devenue vide pour ne pas laisser d'objet mort.
export function toggleBreak(config, key, value) {
  const entry = entryFor(config, key)
  if (entry.break === value) {
    delete entry.break
    if (!entry.type && !entry.side) delete config[key]
  } else {
    entry.break = value
  }
}

// Le côté qu'IMPOSE le type tagué, s'il en impose un.
export function expectedSideOf(config, page) {
  const type = typeOfPage(config, page)
  return type ? (LIMINAIRE_BY_KEY.get(type)?.side ?? null) : null
}

export function isConflicting(config, page) {
  const expected = expectedSideOf(config, page)
  const side = sideOfPage(config, page)
  return !!expected && side !== 'auto' && side !== expected
}

// Les pages RÉELLES d'un vis-à-vis, dans l'ordre verso puis recto. Une blanche
// implicite (insérée pour la parité) n'en est pas une : elle ne porte pas de
// `page`, elle ne vient d'aucune entrée du .odt et ne se découpe donc pas.
export function pagesOfSpread(spread) {
  if (!spread) return []
  return [spread.left, spread.right]
    .filter((cell) => cell && !cell.cover && cell.page)
    .map((cell) => cell.page)
}
