import { entryPlainText } from './liminaire'

// Devine le type d'une page liminaire à partir de signaux DÉTERMINISTES, du plus
// fiable au plus faible :
//  1. le NOM DE STYLE — un style « mentions légales » posé par l'auteur ne ment
//     pas, là où un break-page trompe (cf. le manuscrit témoin) ;
//  2. des MOTS-CLÉS francs (ISBN, « table des matières », « Pour … »…) ;
//  3. le TITRE du livre pour départager faux-titre (titre seul) et page de titre
//     (titre + auteur/sous-titre).
//
// Rend `{ key, why }` (la raison, pour que la suggestion soit lisible et non un
// oracle) ou `null`. Le flou sémantique — « Introduction » qui est un
// avant-propos, une épigraphe reconnue à sa forme — est laissé au NLP et à
// l'utilisateur : mieux vaut ne rien suggérer qu'un faux positif qui se recopie.
export function suggestLiminaireType(page, ctx = {}) {
  if (!page || page.isBlank) return null

  const styles = (page.entries ?? []).map((e) => e.styleName || '').join(' ').toLowerCase()
  const text = (page.entries ?? []).map(entryPlainText).join(' ').trim()
  const low = text.toLowerCase()
  const title = (ctx.title || '').trim().toLowerCase()

  // 1. Nom de style (le plus fiable).
  if (/mention/.test(styles)) return { key: 'mentions-legales', why: 'style « mentions »' }
  if (/d[eé]dicace/.test(styles)) return { key: 'dedicace', why: 'style « dédicace »' }
  if (/[eé]pigraphe/.test(styles)) return { key: 'epigraphe', why: 'style « épigraphe »' }
  if (/faux[-\s]?titre/.test(styles)) return { key: 'faux-titre', why: 'style « faux-titre »' }

  // 2. Mots-clés francs du contenu.
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
  // Dédicace : une adresse courte « Pour / À … ».
  if (/^(pour|à)\s+\S/i.test(text) && text.length <= 40) return { key: 'dedicace', why: '« Pour … »' }

  // 3. Titre du livre : faux-titre = le titre seul ; page de titre = titre + le
  // reste (auteur, sous-titre).
  if (title.length >= 3 && low.includes(title)) {
    const extra = low.split(title).join(' ').replace(/\s+/g, ' ').trim()
    return extra.length > 2
      ? { key: 'page-de-titre', why: 'titre + auteur/sous-titre' }
      : { key: 'faux-titre', why: 'titre seul' }
  }

  return null
}

// Suggestions pour toutes les pages, keyées par `page.key` (l'ancre). Pages
// blanches et sans suggestion exclues. Sert le bouton « suggérer » et l'indice
// inline.
export function suggestAll(pages, ctx = {}) {
  const out = {}
  for (const page of pages ?? []) {
    const s = suggestLiminaireType(page, ctx)
    if (s) out[page.key] = s
  }
  return out
}
