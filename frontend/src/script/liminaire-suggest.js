import { entryPlainText } from './liminaire-pages'
import { typeOfStyleName } from './liminaire-vocab'

// Devine le type d'une page liminaire par signaux déterministes, du plus fiable au plus
// faible : nom de style, mots-clés francs, titre du livre. Rend `{ key, why }` (la raison
// rend la suggestion lisible) ou null. Le flou sémantique est laissé au NLP/utilisateur :
// mieux vaut ne rien suggérer qu'un faux positif qui se recopie.
export function suggestLiminaireType(page, ctx = {}) {
  if (!page || page.isBlank) return null

  const styles = (page.entries ?? []).map((e) => e.styleName || '').join(' ').toLowerCase()
  const text = (page.entries ?? []).map(entryPlainText).join(' ').trim()
  const low = text.toLowerCase()
  const title = (ctx.title || '').trim().toLowerCase()

  // 1. Nom de style (le plus fiable) — MÊME table que la segmentation (typeOfStyleName).
  for (const entry of page.entries ?? []) {
    const key = typeOfStyleName(entry.styleName)
    if (key) return { key, why: `style « ${entry.styleName} »` }
  }
  // Page de titre : style AUTEUR + style TITRE (le faux-titre n'a que le titre).
  if (/auteur/.test(styles) && /titre|title/.test(styles)) return { key: 'page-de-titre', why: 'styles auteur + titre' }

  // 2. Mots-clés francs.
  if (/isbn|tous droits r[eé]serv|d[eé]p[oô]t l[eé]gal|propri[eé]t[eé] intellectuelle/.test(low)) {
    return { key: 'mentions-legales', why: 'ISBN / copyright' }
  }
  if (/du m[eê]me auteur|ouvrages? du m[eê]me/.test(low)) return { key: 'du-meme-auteur', why: '« du même auteur »' }
  if (/table des mati|sommaire/.test(low)) return { key: 'table-des-matieres', why: '« table des matières »' }
  if (/avant[-\s]propos/.test(low)) return { key: 'avant-propos', why: '« avant-propos »' }
  if (/pr[eé]face|prol[eé]gom[eè]ne/.test(low)) return { key: 'preface', why: '« préface »' }
  if (/postface/.test(low)) return { key: 'postface', why: '« postface »' }
  if (/remerciement/.test(low)) return { key: 'remerciements', why: '« remerciements »' }
  if (/avertissement/.test(low)) return { key: 'avertissement', why: '« avertissement »' }
  if (/personnages/.test(low)) return { key: 'personnages', why: '« personnages »' }
  if (/achev[eé] d.?imprimer|colophon/.test(low)) return { key: 'imprimeur', why: '« achevé d’imprimer »' }
  if (/^(pour|à)\s+\S/i.test(text) && text.length <= 40) return { key: 'dedicace', why: '« Pour … »' }

  // 3. Titre du livre : faux-titre = titre seul ; page de titre = titre + le reste.
  if (title.length >= 3 && low.includes(title)) {
    const extra = low.split(title).join(' ').replace(/\s+/g, ' ').trim()
    return extra.length > 2
      ? { key: 'page-de-titre', why: 'titre + auteur/sous-titre' }
      : { key: 'faux-titre', why: 'titre seul' }
  }

  return null
}

// Suggestions pour toutes les pages, keyées par `page.key`. Prior structurel : la
// première page non blanche est le faux-titre, posé seulement si aucun autre signal n'a
// parlé pour elle.
export function suggestAll(pages, ctx = {}) {
  const out = {}
  for (const page of pages ?? []) {
    const s = suggestLiminaireType(page, ctx)
    if (s) out[page.key] = s
  }
  const first = (pages ?? []).find((p) => !p.isBlank)
  if (first && !out[first.key]) out[first.key] = { key: 'faux-titre', why: 'première page du livre' }
  return out
}
